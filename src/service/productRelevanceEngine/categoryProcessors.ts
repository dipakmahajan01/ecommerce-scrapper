import { z } from "zod";
import {
  CategoryProcessor,
  SmartPrixRecord,
  NormalizationContext,
} from "./types";

/**
 * Base class for category processors with common normalization utilities
 */
abstract class BaseCategoryProcessor implements CategoryProcessor {
  abstract process(
    product: SmartPrixRecord,
    context: NormalizationContext
  ): number;
  abstract getCategoryName(): string;
  abstract prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext>;
  abstract validateProduct(product: SmartPrixRecord): boolean;

  /**
   * Normalize a value using min-max normalization with pre-calculated min/max
   */
  protected normalizeValue(
    value: number | null | undefined,
    min: number,
    max: number
  ): number {
    if (value === null || value === undefined || isNaN(value)) {
      return 0;
    }

    if (max === min) {
      // All same value, return 0.5 to maintain scoring integrity
      return 0.5;
    }

    const normalized = this.minMaxNormalize(value, min, max);
    // Ensure result is between 0-1 (minMaxNormalize should already do this, but double-check)
    return Math.max(0, Math.min(1, normalized));
  }

  protected minMaxNormalize(x: number, min: number, max: number) {
    return (x - min) / (max - min);
  }
}

/**
 * Battery Endurance Processor (Weight: batteryEndurance)
 * Uses: battery.capacity.value (mAh)
 */
export class BatteryEnduranceProcessor extends BaseCategoryProcessor {
  private isValidBatteryCapacity(capacity: unknown): boolean {
    return (
      capacity !== null &&
      capacity !== undefined &&
      typeof capacity === "number" &&
      !isNaN(capacity) &&
      isFinite(capacity)
    );
  }

  private readonly batterySchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const batteryCapacity =
        product.normalizedSpecs?.extracted?.battery?.capacity?.value;
      return this.isValidBatteryCapacity(batteryCapacity);
    },
    {
      message: "Battery capacity value must be a valid number",
    }
  );

  getCategoryName(): string {
    return "batteryEndurance";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.batterySchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const values = allProducts
      .map((p) => p.normalizedSpecs.extracted.battery?.capacity?.value)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) {
      return { batteryCapacity: { min: 0, max: 1 } };
    }

    return {
      batteryCapacity: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const capacity = product.normalizedSpecs.extracted.battery?.capacity?.value;
    return this.normalizeValue(
      capacity,
      context.batteryCapacity.min,
      context.batteryCapacity.max
    );
  }
}

/**
 * Software Experience Processor (Weight: softwareExperience)
 * Uses: technical.os, technical.customUi, brand-level update policy (derived)
 */
// export class SoftwareExperienceProcessor extends BaseCategoryProcessor {
//   getCategoryName(): string {
//     return "softwareExperience";
//   }

//   prepareContext(
//     allProducts: SmartPrixRecord[]
//   ): Partial<NormalizationContext> {
//     const scores = allProducts.map((p) => this.calculateSoftwareScore(p));

//     if (scores.length === 0) {
//       return { softwareScore: { min: 0, max: 1 } };
//     }

//     return {
//       softwareScore: {
//         min: Math.min(...scores),
//         max: Math.max(...scores),
//       },
//     };
//   }

//   process(product: SmartPrixRecord, context: NormalizationContext): number {
//     const combinedScore = this.calculateSoftwareScore(product);
//     return this.normalizeValue(
//       combinedScore,
//       context.softwareScore.min,
//       context.softwareScore.max
//     );
//   }

//   private calculateSoftwareScore(product: SmartPrixRecord): number {
//     const specs = product.normalizedSpecs.specs;
//     const technical = specs.technical || {};
//     const os = technical["OS"] || technical["Operating System"] || "";
//     const customUi =
//       technical["Custom UI"] ||
//       technical["User Interface"] ||
//       technical["UI"] ||
//       "";
//     const brand = product.brand || product.normalizedSpecs.meta.brand || "";

//     const osScore = this.getOSScore(os);
//     const uiScore = this.getUIScore(customUi);
//     const brandScore = this.getBrandUpdatePolicyScore(brand);

//     // Combine: OS (40%) + UI (30%) + Brand Policy (30%)
//     return osScore * 0.4 + uiScore * 0.3 + brandScore * 0.3;
//   }

//   private getOSScore(os: string): number {
//     const osLower = os.toLowerCase();
//     // Latest Android versions score higher
//     if (osLower.includes("android 14") || osLower.includes("android 15")) {
//       return 10;
//     }
//     if (osLower.includes("android 13") || osLower.includes("android 12")) {
//       return 8;
//     }
//     if (osLower.includes("android 11") || osLower.includes("android 10")) {
//       return 6;
//     }
//     if (osLower.includes("android")) {
//       return 5;
//     }
//     // iOS versions
//     if (osLower.includes("ios 17") || osLower.includes("ios 18")) {
//       return 10;
//     }
//     if (osLower.includes("ios 16") || osLower.includes("ios 15")) {
//       return 8;
//     }
//     if (osLower.includes("ios")) {
//       return 7;
//     }
//     return 3; // Unknown/other
//   }

//   private getUIScore(customUi: string): number {
//     const uiLower = customUi.toLowerCase();
//     // Stock or near-stock UIs score higher
//     if (
//       uiLower.includes("stock") ||
//       uiLower.includes("pure") ||
//       uiLower.includes("vanilla") ||
//       uiLower === "" ||
//       uiLower === "none"
//     ) {
//       return 10;
//     }
//     // Well-known optimized UIs
//     if (
//       uiLower.includes("one ui") ||
//       uiLower.includes("oxygenos") ||
//       uiLower.includes("coloros") ||
//       uiLower.includes("miui")
//     ) {
//       return 7;
//     }
//     // Other custom UIs
//     if (uiLower.length > 0) {
//       return 5;
//     }
//     return 3; // Unknown
//   }

//   private getBrandUpdatePolicyScore(brand: string): number {
//     const brandLower = brand.toLowerCase();
//     // Brands known for good update policies
//     if (
//       brandLower.includes("google") ||
//       brandLower.includes("pixel") ||
//       brandLower.includes("samsung") ||
//       brandLower.includes("oneplus") ||
//       brandLower.includes("apple")
//     ) {
//       return 10;
//     }
//     // Mid-tier update support
//     if (
//       brandLower.includes("xiaomi") ||
//       brandLower.includes("oppo") ||
//       brandLower.includes("vivo") ||
//       brandLower.includes("realme")
//     ) {
//       return 6;
//     }
//     // Default for unknown brands
//     return 5;
//   }
// }

/**
 * Display Quality Processor (Weight: displayQuality)
 * Uses: display.type (tiered), display.ppi, display.refreshRate, peak brightness, HDR support
 */
export class DisplayQualityProcessor extends BaseCategoryProcessor {
  private isValidNumber(value: unknown): boolean {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "number" &&
      !isNaN(value) &&
      isFinite(value)
    );
  }

  private hasRequiredDisplayFields(display: unknown): boolean {
    if (!display || typeof display !== "object") return false;

    const displayObj = display as {
      type?: { score?: unknown };
      ppi?: { value: unknown } | null;
      refreshRate?: { value: unknown } | null;
      brightness?: { value: unknown } | null;
    };

    const hasTypeScore = this.isValidNumber(displayObj.type?.score);
    const hasPpiValue = this.isValidNumber(displayObj.ppi?.value);
    const hasRefreshRateValue = this.isValidNumber(
      displayObj.refreshRate?.value
    );
    const hasBrightnessValue = this.isValidNumber(displayObj.brightness?.value);

    return (
      hasTypeScore && hasPpiValue && hasRefreshRateValue && hasBrightnessValue
    );
  }

  private readonly displaySchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const display = product.normalizedSpecs?.extracted?.display;
      return this.hasRequiredDisplayFields(display);
    },
    {
      message:
        "Display must have type.score, ppi.value, refreshRate.value, and brightness.value as valid numbers",
    }
  );

  getCategoryName(): string {
    return "displayQuality";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.displaySchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const typeScores: number[] = [];
    const ppiValues: number[] = [];
    const refreshRateValues: number[] = [];
    const brightnessValues: number[] = [];
    // const hdrScores: number[] = [];

    allProducts.forEach((p) => {
      const display = p.normalizedSpecs.extracted.display;

      // Display type score
      if (display?.type?.score !== undefined) {
        typeScores.push(display.type.score);
      }

      // PPI
      if (display?.ppi?.value !== undefined && !isNaN(display.ppi.value)) {
        ppiValues.push(display.ppi.value);
      }

      // Refresh rate
      if (
        display?.refreshRate?.value !== undefined &&
        !isNaN(display.refreshRate.value)
      ) {
        refreshRateValues.push(display.refreshRate.value);
      }

      // Brightness
      if (
        display?.brightness?.value !== undefined &&
        !isNaN(display.brightness.value)
      ) {
        brightnessValues.push(display.brightness.value);
      }

      // HDR score
      // if (display?.hdr?.score !== undefined) {
      //   hdrScores.push(display.hdr.score);
      // }
    });

    return {
      displayType: {
        min: typeScores.length > 0 ? Math.min(...typeScores) : 0,
        max: typeScores.length > 0 ? Math.max(...typeScores) : 10,
      },
      displayPpi: {
        min: ppiValues.length > 0 ? Math.min(...ppiValues) : 0,
        max: ppiValues.length > 0 ? Math.max(...ppiValues) : 1,
      },
      displayRefreshRate: {
        min: refreshRateValues.length > 0 ? Math.min(...refreshRateValues) : 0,
        max: refreshRateValues.length > 0 ? Math.max(...refreshRateValues) : 1,
      },
      displayBrightness: {
        min: brightnessValues.length > 0 ? Math.min(...brightnessValues) : 0,
        max: brightnessValues.length > 0 ? Math.max(...brightnessValues) : 1,
      },
      // displayHdr: {
      //   min: hdrScores.length > 0 ? Math.min(...hdrScores) : 0,
      //   max: hdrScores.length > 0 ? Math.max(...hdrScores) : 10,
      // },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const display = product.normalizedSpecs.extracted.display;

    // Display type score (normalize from its range to 0-1)
    const typeScoreRaw = display?.type?.score ?? 0;
    const typeScore = this.normalizeValue(
      typeScoreRaw,
      context.displayType.min,
      context.displayType.max
    );

    // PPI score
    const ppiScore = this.normalizeValue(
      display?.ppi?.value,
      context.displayPpi.min,
      context.displayPpi.max
    );

    // Refresh rate score
    const refreshRateScore = this.normalizeValue(
      display?.refreshRate?.value,
      context.displayRefreshRate.min,
      context.displayRefreshRate.max
    );

    // Brightness score
    const brightnessScore = this.normalizeValue(
      display?.brightness?.value,
      context.displayBrightness.min,
      context.displayBrightness.max
    );

    // HDR score (normalize from its range to 0-1)
    // const hdrScoreRaw = display?.hdr?.score ?? 0;
    // const hdrScore = this.normalizeValue(
    //   hdrScoreRaw,
    //   context.displayHdr.min,
    //   context.displayHdr.max
    // );

    // Weighted combination:
    // Type: 30%, PPI: 25%, Refresh Rate: 20%, Brightness: 15%, HDR: 10%
    // All components are already normalized 0-1, so result will be 0-1
    const combinedScore =
      typeScore * 0.3 +
      ppiScore * 0.25 +
      refreshRateScore * 0.2 +
      brightnessScore * 0.15;
    // +
    // hdrScore * 0.1;

    // Since all components are 0-1 and weights sum to 1, result is guaranteed 0-1
    return combinedScore;
  }
}

/**
 * CPU Performance Processor (Weight: cpuPerformance)
 * Uses: technical.benchmark.antutu.breakdown.CPU
 */
export class CPUPerformanceProcessor extends BaseCategoryProcessor {
  private isParseableNumberString(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed);
  }

  private readonly cpuSchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const cpuBenchmarkScore =
        product.normalizedSpecs?.extracted?.technical?.benchmark?.antutu
          ?.breakdown?.CPU;
      return this.isParseableNumberString(cpuBenchmarkScore);
    },
    {
      message: "CPU benchmark score must be a parseable number string",
    }
  );

  getCategoryName(): string {
    return "cpuPerformance";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.cpuSchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const values = allProducts
      .map((p) => {
        const scoreStr =
          p.normalizedSpecs.extracted.technical.benchmark.antutu.breakdown.CPU;
        return typeof scoreStr === "string" ? parseFloat(scoreStr) : null;
      })
      .filter((v): v is number => v !== null && !isNaN(v));

    if (values.length === 0) {
      return { cpuScore: { min: 0, max: 1 } };
    }

    return {
      cpuScore: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const cpuScoreStr =
      product.normalizedSpecs.extracted.technical.benchmark.antutu.breakdown
        .CPU;
    const cpuScore =
      typeof cpuScoreStr === "string" ? parseFloat(cpuScoreStr) : null;

    return this.normalizeValue(
      cpuScore,
      context.cpuScore.min,
      context.cpuScore.max
    );
  }
}

/**
 * GPU Performance Processor (Weight: gpuPerformance)
 * Uses: technical.benchmark.antutu.breakdown.GPU
 */
export class GPUPerformanceProcessor extends BaseCategoryProcessor {
  private isParseableNumberString(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed);
  }

  private readonly gpuSchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const gpuBenchmarkScore =
        product.normalizedSpecs?.extracted?.technical?.benchmark?.antutu
          ?.breakdown?.GPU;
      return this.isParseableNumberString(gpuBenchmarkScore);
    },
    {
      message: "GPU benchmark score must be a parseable number string",
    }
  );

  getCategoryName(): string {
    return "gpuPerformance";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.gpuSchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const values = allProducts
      .map((p) => {
        const scoreStr =
          p.normalizedSpecs.extracted.technical.benchmark.antutu.breakdown.GPU;
        return typeof scoreStr === "string" ? parseFloat(scoreStr) : null;
      })
      .filter((v): v is number => v !== null && !isNaN(v));

    if (values.length === 0) {
      return { gpuScore: { min: 0, max: 1 } };
    }

    return {
      gpuScore: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const gpuScoreStr =
      product.normalizedSpecs.extracted.technical.benchmark.antutu.breakdown
        .GPU;
    const gpuScore =
      typeof gpuScoreStr === "string" ? parseFloat(gpuScoreStr) : null;

    return this.normalizeValue(
      gpuScore,
      context.gpuScore.min,
      context.gpuScore.max
    );
  }
}

export class RAMCapacityProcessor extends BaseCategoryProcessor {
  private parseRAMValue(ramString: unknown): number | null {
    if (typeof ramString !== "string" || !ramString.trim()) {
      return null;
    }

    const match = ramString.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (!match) {
      return null;
    }

    const value = parseFloat(match[1]);
    if (isNaN(value) || !isFinite(value) || value <= 0) {
      return null;
    }

    return value;
  }

  private readonly ramSchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const ramString = product.normalizedSpecs?.specs?.memory?.ram;
      const ramValue = this.parseRAMValue(ramString);
      return ramValue !== null;
    },
    {
      message:
        "RAM value must be a parseable string in GB format (e.g., '16 GB')",
    }
  );

  getCategoryName(): string {
    return "ramCapacity";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.ramSchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const values = allProducts
      .map((p) => {
        const ramString = p.normalizedSpecs.specs?.memory?.ram;
        return this.parseRAMValue(ramString);
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return { ramCapacity: { min: 0, max: 1 } };
    }

    return {
      ramCapacity: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const ramString = product.normalizedSpecs.specs?.memory?.ram;
    const ramValue = this.parseRAMValue(ramString);

    return this.normalizeValue(
      ramValue,
      context.ramCapacity.min,
      context.ramCapacity.max
    );
  }
}

export class ROMCapacityProcessor extends BaseCategoryProcessor {
  private parseROMValue(storageString: unknown): number | null {
    if (typeof storageString !== "string" || !storageString.trim()) {
      return null;
    }

    const tbMatch = storageString.match(/(\d+(?:\.\d+)?)\s*TB/i);
    if (tbMatch) {
      const value = parseFloat(tbMatch[1]);
      if (isNaN(value) || !isFinite(value) || value <= 0) {
        return null;
      }
      return value * 1024;
    }

    const gbMatch = storageString.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (gbMatch) {
      const value = parseFloat(gbMatch[1]);
      if (isNaN(value) || !isFinite(value) || value <= 0) {
        return null;
      }
      return value;
    }

    return null;
  }

  private readonly romSchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const storageString = product.normalizedSpecs?.specs?.memory?.storage;
      const romValue = this.parseROMValue(storageString);
      return romValue !== null;
    },
    {
      message:
        "Storage value must be a parseable string in GB or TB format (e.g., '512 GB' or '1 TB')",
    }
  );

  getCategoryName(): string {
    return "romCapacity";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.romSchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const values = allProducts
      .map((p) => {
        const storageString = p.normalizedSpecs.specs?.memory?.storage;
        return this.parseROMValue(storageString);
      })
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return { romCapacity: { min: 0, max: 1 } };
    }

    return {
      romCapacity: {
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const storageString = product.normalizedSpecs.specs?.memory?.storage;
    const romValue = this.parseROMValue(storageString);

    return this.normalizeValue(
      romValue,
      context.romCapacity.min,
      context.romCapacity.max
    );
  }
}

/**
 * Camera Quality Processor (Weight: cameraQuality)
 * Uses: camera.rearCamera (megapixel, camera type: main/ultrawide/telephoto/macro)
 */
export class CameraQualityProcessor extends BaseCategoryProcessor {
  private isValidNumber(value: unknown): boolean {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === "number" &&
      !isNaN(value) &&
      isFinite(value)
    );
  }

  private hasMainCameraWithValidMegapixel(rearCameras: unknown): boolean {
    if (!Array.isArray(rearCameras) || rearCameras.length === 0) {
      return false;
    }

    const mainCamera = rearCameras.find((camera) => camera.position === "main");

    if (!mainCamera) {
      return false;
    }

    return this.isValidNumber(mainCamera.megapixel);
  }

  private readonly cameraSchema = z.any().refine(
    (product: SmartPrixRecord) => {
      const rearCameras =
        product.normalizedSpecs?.extracted?.camera?.rearCamera || [];
      return this.hasMainCameraWithValidMegapixel(rearCameras);
    },
    {
      message: "Camera must have at least one main camera with valid megapixel",
    }
  );

  getCategoryName(): string {
    return "cameraQuality";
  }

  validateProduct(product: SmartPrixRecord): boolean {
    const result = this.cameraSchema.safeParse(product);
    return result.success;
  }

  prepareContext(
    allProducts: SmartPrixRecord[]
  ): Partial<NormalizationContext> {
    const mainMpValues: number[] = [];
    const cameraCounts: number[] = [];

    allProducts.forEach((p) => {
      const rearCameras = p.normalizedSpecs.extracted.camera.rearCamera || [];

      // Main camera megapixels
      const mainCamera = rearCameras.find((c) => c.position === "main");
      if (mainCamera?.megapixel !== undefined) {
        mainMpValues.push(mainCamera.megapixel);
      }

      // Camera count
      // const hasUltrawide = rearCameras.some(
      //   (c) => c.position === "ultrawide" || c.type === "ultrawide"
      // );
      // const hasTelephoto = rearCameras.some(
      //   (c) => c.position === "telephoto" || c.type === "telephoto"
      // );
      // const hasMacro = rearCameras.some(
      //   (c) => c.position === "macro" || c.type === "macro"
      // );
      // const cameraCount =
      //   1 +
      //   (hasUltrawide ? 1 : 0) +
      //   (hasTelephoto ? 1 : 0) +
      //   (hasMacro ? 1 : 0);
      // cameraCounts.push(cameraCount);
    });

    return {
      cameraMainMp: {
        min: mainMpValues.length > 0 ? Math.min(...mainMpValues) : 0,
        max: mainMpValues.length > 0 ? Math.max(...mainMpValues) : 1,
      },
      // cameraCount: {
      //   min: cameraCounts.length > 0 ? Math.min(...cameraCounts) : 1,
      //   max: cameraCounts.length > 0 ? Math.max(...cameraCounts) : 1,
      // },
    };
  }

  process(product: SmartPrixRecord, context: NormalizationContext): number {
    const rearCameras = product.normalizedSpecs.extracted.camera.rearCamera;

    if (!rearCameras || rearCameras.length === 0) {
      return 0;
    }

    // Extract main camera megapixels
    const mainCamera = rearCameras.find((c) => c.position === "main");
    const mainMp = mainCamera?.megapixel || 0;

    // // Count camera types (main, ultrawide, telephoto, macro)
    // const hasUltrawide = rearCameras.some(
    //   (c) => c.position === "ultrawide" || c.type === "ultrawide"
    // );
    // const hasTelephoto = rearCameras.some(
    //   (c) => c.position === "telephoto" || c.type === "telephoto"
    // );
    // const hasMacro = rearCameras.some(
    //   (c) => c.position === "macro" || c.type === "macro"
    // );

    // const cameraCount =
    //   1 + (hasUltrawide ? 1 : 0) + (hasTelephoto ? 1 : 0) + (hasMacro ? 1 : 0);

    // // Normalize camera count
    // const cameraCountScore = this.normalizeValue(
    //   cameraCount,
    //   context.cameraCount.min,
    //   context.cameraCount.max
    // );

    // Normalize main camera megapixel
    const mainMpScore = this.normalizeValue(
      mainMp,
      context.cameraMainMp.min,
      context.cameraMainMp.max
    );

    // Combine: Main MP (70%) + Camera Count (30%)
    // Both are normalized 0-1, so result is guaranteed 0-1
    const combinedScore = mainMpScore * 0.7;
    // + cameraCountScore * 0.3;

    return combinedScore;
  }
}

/**
 * Factory function to get all category processors
 */
export function getCategoryProcessors(): CategoryProcessor[] {
  return [
    new BatteryEnduranceProcessor(),
    // new SoftwareExperienceProcessor(),
    new DisplayQualityProcessor(),
    new CPUPerformanceProcessor(),
    new GPUPerformanceProcessor(),
    new CameraQualityProcessor(),
    new RAMCapacityProcessor(),
    new ROMCapacityProcessor(),
  ];
}
