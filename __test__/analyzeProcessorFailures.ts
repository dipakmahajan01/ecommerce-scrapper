import fs from "fs";
import path from "path";
import { getCategoryProcessors } from "../src/service/productRelevanceEngine/categoryProcessors";
import { SmartPrixRecord } from "../src/service/productRelevanceEngine/types";

type FailedValueEntry = {
  value: unknown;
  documentIds: string[];
};

type ProcessorFailure = {
  processor: string;
  failedCount: number;
  failedValues: FailedValueEntry[];
};

type FailureReport = {
  totalRecords: number;
  processorFailures: ProcessorFailure[];
};

const MISSING = "MISSING" as const;

function getValueOrMissing<T>(value: T | undefined | null): T | "MISSING" {
  if (value === undefined || value === null) {
    return MISSING;
  }
  return value;
}

function extractFailingValue(
  product: SmartPrixRecord,
  processorName: string
): unknown {
  switch (processorName) {
    case "batteryEndurance": {
      const battery = product.normalizedSpecs?.extracted?.battery;
      return {
        capacityValue: getValueOrMissing(battery?.capacity?.value),
      };
    }

    case "displayQuality": {
      const display = product.normalizedSpecs?.extracted?.display;
      return {
        typeType: getValueOrMissing(display?.type?.type),
        typeScore: getValueOrMissing(display?.type?.score),
        ppiValue: getValueOrMissing(display?.ppi?.value),
        refreshRateValue: getValueOrMissing(display?.refreshRate?.value),
        brightnessValue: getValueOrMissing(display?.brightness?.value),
      };
    }

    case "cpuPerformance": {
      const benchmark =
        product.normalizedSpecs?.extracted?.technical?.benchmark;
      return {
        cpuScore: getValueOrMissing(benchmark?.antutu?.breakdown?.CPU),
      };
    }

    case "gpuPerformance": {
      const benchmark =
        product.normalizedSpecs?.extracted?.technical?.benchmark;
      return {
        gpuScore: getValueOrMissing(benchmark?.antutu?.breakdown?.GPU),
      };
    }

    case "cameraQuality": {
      const rearCameras =
        product.normalizedSpecs?.extracted?.camera?.rearCamera;
      if (!Array.isArray(rearCameras)) {
        return {
          rearCamera: MISSING,
          mainCameraMegapixel: MISSING,
          hasMainCamera: false,
        };
      }
      if (rearCameras.length === 0) {
        return {
          rearCamera: "EMPTY_ARRAY",
          mainCameraMegapixel: MISSING,
          hasMainCamera: false,
        };
      }
      const mainCamera = rearCameras.find((c) => c.position === "main");
      return {
        rearCameraCount: rearCameras.length,
        mainCameraMegapixel: mainCamera
          ? getValueOrMissing(mainCamera.megapixel)
          : MISSING,
        hasMainCamera: !!mainCamera,
      };
    }

    case "ramCapacity": {
      const memory = product.normalizedSpecs?.specs?.memory;
      return {
        ram: getValueOrMissing(memory?.ram),
      };
    }

    case "romCapacity": {
      const memory = product.normalizedSpecs?.specs?.memory;
      return {
        storage: getValueOrMissing(memory?.storage),
      };
    }

    default:
      return { unknown: MISSING };
  }
}

function getChipset(product: SmartPrixRecord): string {
  const chipset = product.normalizedSpecs?.extracted?.technical?.chipset;
  if (typeof chipset === "string" && chipset.trim()) {
    return chipset.trim();
  }
  return MISSING;
}

function serializeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function analyzeProcessorFailures(): void {
  const deviceListPath = path.resolve(process.cwd(), "data/deviceList.json");

  let devices: SmartPrixRecord[];
  try {
    const fileContents = fs.readFileSync(deviceListPath, "utf-8");
    devices = JSON.parse(fileContents) as SmartPrixRecord[];
  } catch (error) {
    console.error("Failed to load deviceList.json:", error);
    process.exit(1);
  }

  console.log(`Loaded ${devices.length} devices`);

  const processors = getCategoryProcessors();
  const failuresByProcessor = new Map<
    string,
    Map<string, { value: unknown; documentIds: string[] }>
  >();
  const chipsetFailures = new Map<
    string,
    {
      value: { chipset: string; cpuScore?: unknown; gpuScore?: unknown };
      cpuDocumentIds: Set<string>;
      gpuDocumentIds: Set<string>;
    }
  >();

  for (const processor of processors) {
    const processorName = processor.getCategoryName();
    if (
      processorName !== "cpuPerformance" &&
      processorName !== "gpuPerformance"
    ) {
      failuresByProcessor.set(processorName, new Map());
    }
  }

  for (const device of devices) {
    for (const processor of processors) {
      const processorName = processor.getCategoryName();
      const isValid = processor.validateProduct(device);

      if (!isValid) {
        if (
          processorName === "cpuPerformance" ||
          processorName === "gpuPerformance"
        ) {
          const chipset = getChipset(device);
          const chipsetKey =
            chipset === MISSING ? `chipset_${MISSING}` : chipset;
          const failingValue = extractFailingValue(device, processorName);

          if (!chipsetFailures.has(chipsetKey)) {
            chipsetFailures.set(chipsetKey, {
              value: { chipset },
              cpuDocumentIds: new Set<string>(),
              gpuDocumentIds: new Set<string>(),
            });
          }

          const chipsetEntry = chipsetFailures.get(chipsetKey)!;

          if (processorName === "cpuPerformance") {
            chipsetEntry.cpuDocumentIds.add(device._id);
            chipsetEntry.value.cpuScore = (
              failingValue as { cpuScore: unknown }
            ).cpuScore;
          } else {
            chipsetEntry.gpuDocumentIds.add(device._id);
            chipsetEntry.value.gpuScore = (
              failingValue as { gpuScore: unknown }
            ).gpuScore;
          }
        } else {
          const failingValue = extractFailingValue(device, processorName);
          const serializedKey = serializeValue(failingValue);
          const processorFailures = failuresByProcessor.get(processorName)!;

          if (processorFailures.has(serializedKey)) {
            processorFailures.get(serializedKey)!.documentIds.push(device._id);
          } else {
            processorFailures.set(serializedKey, {
              value: failingValue,
              documentIds: [device._id],
            });
          }
        }
      }
    }
  }

  const processorFailures: ProcessorFailure[] = [];

  for (const [processorName, failures] of failuresByProcessor) {
    const failedValues: FailedValueEntry[] = [];
    let totalFailed = 0;

    for (const entry of failures.values()) {
      failedValues.push({
        value: entry.value,
        documentIds: entry.documentIds,
      });
      totalFailed += entry.documentIds.length;
    }

    processorFailures.push({
      processor: processorName,
      failedCount: totalFailed,
      failedValues,
    });
  }

  if (chipsetFailures.size > 0) {
    const cpuFailedValues: FailedValueEntry[] = [];
    const gpuFailedValues: FailedValueEntry[] = [];
    let cpuTotalFailed = 0;
    let gpuTotalFailed = 0;

    for (const chipsetEntry of chipsetFailures.values()) {
      const value = chipsetEntry.value;

      if (
        value.cpuScore !== undefined &&
        chipsetEntry.cpuDocumentIds.size > 0
      ) {
        const cpuDocumentIdsArray = Array.from(chipsetEntry.cpuDocumentIds);
        cpuFailedValues.push({
          value: { chipset: value.chipset, cpuScore: value.cpuScore },
          documentIds: cpuDocumentIdsArray,
        });
        cpuTotalFailed += cpuDocumentIdsArray.length;
      }

      if (
        value.gpuScore !== undefined &&
        chipsetEntry.gpuDocumentIds.size > 0
      ) {
        const gpuDocumentIdsArray = Array.from(chipsetEntry.gpuDocumentIds);
        gpuFailedValues.push({
          value: { chipset: value.chipset, gpuScore: value.gpuScore },
          documentIds: gpuDocumentIdsArray,
        });
        gpuTotalFailed += gpuDocumentIdsArray.length;
      }
    }

    if (cpuFailedValues.length > 0) {
      processorFailures.push({
        processor: "cpuPerformance",
        failedCount: cpuTotalFailed,
        failedValues: cpuFailedValues,
      });
    }

    if (gpuFailedValues.length > 0) {
      processorFailures.push({
        processor: "gpuPerformance",
        failedCount: gpuTotalFailed,
        failedValues: gpuFailedValues,
      });
    }
  }

  processorFailures.sort((a, b) => b.failedCount - a.failedCount);

  const report: FailureReport = {
    totalRecords: devices.length,
    processorFailures,
  };

  const testDir = __dirname;
  const existingFiles = fs.readdirSync(testDir);
  const pattern = /^processor-failures-(\d+)\.json$/;
  let maxCount = 0;

  for (const file of existingFiles) {
    const match = file.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count > maxCount) {
        maxCount = count;
      }
    }
  }

  const nextCount = maxCount + 1;
  const outputPath = path.resolve(testDir, `processor-failures-${nextCount}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`\nReport written to: ${outputPath}`);
  console.log("\nSummary:");
  for (const pf of processorFailures) {
    console.log(
      `  ${pf.processor}: ${pf.failedCount} failures (${pf.failedValues.length} unique values)`
    );
  }
}

analyzeProcessorFailures();
