import { ExtractedSpecs, SmartPrixRecord } from "./types";

function norm(s: string) {
  // Remove (), standalone +, but preserve spaces.
  // Keep everything else as-is.
  return s
    .toLowerCase()
    .replace(/\(|\)/g, "") // Remove all parentheses
    .replace(/\s\+\s/g, " ") // Remove standalone plus with spaces on both sides
    .replace(/^\+\s/g, "") // Remove standalone plus at the start
    .replace(/\s\+$/g, "") // Remove standalone plus at the end
    .replace(/\s{2,}/g, " ") // Convert multiple spaces to one
    .trim();
}

const tokenize = (str: string) => norm(str).split(/\s+/).filter(Boolean);

export function tokenSimilarity(a: string, b: string) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  const intersection = [...aTokens].filter((token) => bTokens.has(token));
  const union = new Set([...aTokens, ...bTokens]);
  return intersection.length / (union.size || 1);
}

function updateHighLow(
  acc: { high: number; low: number },
  value: number | null | undefined
) {
  // Helper to update high/low
  if (typeof value !== "number" || isNaN(value)) return;
  if (value > acc.high) acc.high = value;
  if (value < acc.low) acc.low = value;
}

const initialValue = Number.POSITIVE_INFINITY;
const initialNeg = Number.NEGATIVE_INFINITY;
// Post-process inits in case no values (leave at null if never set)
function normalizeStatRange(stat: { high: number; low: number }) {
  return {
    high: stat.high === initialNeg ? null : stat.high,
    low: stat.low === initialValue ? null : stat.low,
  };
}

export function getHighestAndLowestValues(products: SmartPrixRecord[]) {
  // Initialize for each field you care about, now also considering displayType (score) and displayResolution (value)
  const stats = {
    brightness: { high: initialNeg, low: initialValue },
    refreshRate: { high: initialNeg, low: initialValue },
    resolutionPPI: { high: initialNeg, low: initialValue },
    batteryCapacity: { high: initialNeg, low: initialValue },
    fastCharging: { high: initialNeg, low: initialValue },
    rearMp: { high: initialNeg, low: initialValue },
    frontMp: { high: initialNeg, low: initialValue },
    displayType: { high: initialNeg, low: initialValue },
    // displayResolution: { high: initialNeg, low: initialValue },
  };

  for (const product of products) {
    // Display related
    updateHighLow(
      stats.brightness,
      product.normalizedSpecs.extracted.display?.brightness?.value
    );
    updateHighLow(
      stats.refreshRate,
      product.normalizedSpecs.extracted.display?.refreshRate?.value
    );
    updateHighLow(
      stats.resolutionPPI,
      product.normalizedSpecs.extracted.display?.ppi?.value
    );
    // Display type score
    updateHighLow(
      stats.displayType,
      product.normalizedSpecs.extracted.display?.type?.score
    );
    // Display resolution (native value, e.g., 1080, 1440, etc)
    // updateHighLow(
    //   stats.displayResolution,
    //   product.normalizedSpecs.extracted.display?.resolution?.value
    // );

    // Battery
    updateHighLow(
      stats.batteryCapacity,
      product.normalizedSpecs.extracted.battery?.capacity?.value
    );
    updateHighLow(
      stats.fastCharging,
      product.normalizedSpecs.extracted.battery?.fastCharging?.power?.value
    );

    // Camera - take extreme among all units
    // Only consider the main camera (position: "main") for both rear and front cameras
    if (product.normalizedSpecs.extracted.camera.rearCamera.length) {
      const mainRear = product.normalizedSpecs.extracted.camera.rearCamera.find(
        (c: any) => c.position === "main"
      );
      if (mainRear) {
        updateHighLow(stats.rearMp, mainRear.megapixel);
      }
    }
    if (product.normalizedSpecs.extracted.camera.frontCamera.length) {
      const mainFront =
        product.normalizedSpecs.extracted.camera.frontCamera.find(
          (c: any) => c.position === "main"
        );
      if (mainFront) {
        updateHighLow(stats.frontMp, mainFront.megapixel);
      }
    }
  }

  const highestAndLowestValues = Object.fromEntries(
    Object.entries(stats).map(([k, v]) => [k, normalizeStatRange(v)])
  );
  return highestAndLowestValues as typeof stats;
}

// Create a properly typed helper for nested property access (with array support)
export function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => {
    if (current == null) return undefined;
    const match = key.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const arrayVal = current[match[1]];
      if (Array.isArray(arrayVal)) {
        return arrayVal[parseInt(match[2], 10)];
      }
      return undefined;
    } else {
      return current[key];
    }
  }, obj);
}

export const minMaxNormalize = (x: number, min: number, max: number) => {
  return (x - min) / (max - min);
};

