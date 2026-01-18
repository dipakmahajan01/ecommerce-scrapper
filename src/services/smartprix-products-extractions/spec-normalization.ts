import { FullSpecsResult } from "./html-parser";
import SocDataSingleton from "./soc-data";

// Types for extracted values

// Display extraction types
export type DisplayTypeValue = {
  type: string;
  score: number;
};

export type BrightnessValue = {
  value: number;
  unit: "nits";
} | null;

export type DisplayResolution = {
  value: string;
  unit: "pixels";
} | null;

export type RefreshRate = {
  value: number;
  unit: "Hz";
} | null;

export type PpiValue = {
  value: number;
  unit: "ppi";
} | null;

export type HDRValue = {
  type: string | null;
  score: number;
};

export type ColorDepthValue = {
  value: number;
  unit: "bit";
} | null;

export type ExtractedDisplay = {
  type?: DisplayTypeValue;
  brightness: BrightnessValue;
  resolution: DisplayResolution;
  refreshRate: RefreshRate;
  ppi: PpiValue;
  hdr: HDRValue;
  colorDepth: ColorDepthValue;
};

// Battery extraction types
export type BatteryCapacity = {
  value: number;
  unit: "mAh";
} | null;

export type BatteryFastCharging = {
  supported: boolean;
  power: { value: number; unit: "W" } | null;
};

export type ExtractedBattery = {
  capacity: BatteryCapacity;
  fastCharging: BatteryFastCharging;
};

// Camera extraction types
export type CameraUnit = {
  megapixel: number;
  position: "main" | "ultrawide" | "telephoto" | "macro" | "depth" | "unknown";
  type: "wide" | "ultrawide" | "telephoto" | "macro" | "depth" | "unknown";
};

export type ExtractedCamera = {
  rearCamera: CameraUnit[];
  frontCamera: CameraUnit[];
  ois: unknown; // Could add a more specific type if known
};

// Technical/CPU extraction types
export type BenchmarkData = {
  antutu?: { total?: string | null; breakdown?: Record<string, string> } | null;
  geekbench?: { breakdown?: Record<string, string> } | null;
};

export type ExtractedTechnical = {
  chipset: string;
  benchmark: BenchmarkData;
};

// All extracted values type
export type ExtractedSpecs = {
  display?: ExtractedDisplay;
  battery?: ExtractedBattery;
  camera?: ExtractedCamera;
  technical?: ExtractedTechnical;
};

// ======================
// SCORE V4 — N-GRAM MATCH
// ======================

function normalizeNgram(s: string): string {
  return s
    .toLowerCase()
    .replace(/®|™|\(|\)/g, "")
    .replace(/[^a-z0-9]/g, "") // remove spaces too
    .trim();
}

function ngrams(str: string, n = 4): string[] {
  const grams: string[] = [];
  if (str.length < n) return grams;
  for (let i = 0; i <= str.length - n; i++) {
    grams.push(str.slice(i, i + n));
  }
  return grams;
}

function score_v4(title: string, input: string, n = 4): number {
  const A = normalizeNgram(title);
  const B = normalizeNgram(input);
  if (!A || !B) return 0;

  const minLength = Math.min(A.length, B.length);
  let adaptiveN = n;
  if (minLength < 15) {
    adaptiveN = 2;
  } else if (minLength < 30) {
    adaptiveN = 3;
  } else {
    adaptiveN = 4;
  }

  const gA = ngrams(A, adaptiveN);
  const gB = ngrams(B, adaptiveN);
  if (!gA.length || !gB.length) return 0;
  const setA = new Set(gA);
  const setB = new Set(gB);
  let intersection = 0;
  for (const g of setA) {
    if (setB.has(g)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union; // Jaccard
}

// ======================

function extractBrightness(input: string): BrightnessValue {
  if (!input) return null;

  const matches = input.toLowerCase().match(/(\d+(?:\.\d+)?)\s*nits?/g);

  if (!matches) return null;

  const values = matches.map((m) => parseFloat(m));
  const max = Math.max(...values);

  return { value: max, unit: "nits" };
}

function parseDisplayResolutionAndRefresh(str: string): {
  resolution: DisplayResolution;
  refreshRate: RefreshRate;
} {
  const resMatch = str.match(/(\d+)\s*x\s*(\d+)\s*pixels/i);
  const hzMatch = str.match(/(\d+)\s*Hz/i);

  return {
    resolution: resMatch
      ? { value: `${resMatch[1]}x${resMatch[2]}`, unit: "pixels" }
      : null,

    refreshRate: hzMatch ? { value: Number(hzMatch[1]), unit: "Hz" } : null,
  };
}

function parsePpiValue(str: string): PpiValue {
  const match = str.match(/(\d+)\s*PPI/i);

  return match ? { value: Number(match[1]), unit: "ppi" } : null;
}

function parseHDR(str: string): HDRValue {
  const HDR_CONFIG = [
    { type: "DolbyVision", patterns: ["dolby vision"], score: 1.0 },
    { type: "HDR10+", patterns: ["hdr10+"], score: 0.9 },
    { type: "HDR10", patterns: ["hdr10"], score: 0.7 },
    { type: "HLG", patterns: ["hlg"], score: 0.6 },
  ];

  if (!str || typeof str !== "string") {
    return { type: null, score: 0 };
  }

  const s = str.toLowerCase();

  for (const entry of HDR_CONFIG) {
    for (const pattern of entry.patterns) {
      if (s.includes(pattern)) {
        return { type: entry.type, score: entry.score };
      }
    }
  }

  return { type: null, score: 0 };
}

function parseColorDepth(str: string): ColorDepthValue {
  if (!str || typeof str !== "string") return null;

  const COLOR_DEPTH_CONFIG: {
    patterns: string[];
    value: number;
    unit: "bit";
  }[] = [
    { patterns: ["1b colors", "1 billion"], value: 10, unit: "bit" },
    { patterns: ["16m colors", "16 million"], value: 8, unit: "bit" },
  ];

  const s = str.toLowerCase();

  for (const entry of COLOR_DEPTH_CONFIG) {
    for (const pattern of entry.patterns) {
      if (s.includes(pattern)) {
        // entry.unit is always "bit" (type-safe)
        return { value: entry.value, unit: entry.unit };
      }
    }
  }

  return null;
}

function parseBatteryCapacity(input: unknown): BatteryCapacity {
  if (typeof input !== "string") return null;

  const match = input.match(/(\d{2,5})\s*mAh/i);

  if (!match) return null;

  return {
    value: Number(match[1]),
    unit: "mAh",
  };
}

function parseFastCharging(input: unknown): BatteryFastCharging {
  if (typeof input !== "string" || !input.trim()) {
    return { supported: false, power: null };
  }

  const wattMatches = input.match(/(\d+(?:\.\d+)?)\s*W/gi);

  if (!wattMatches) {
    // "Yes" but no wattage info
    return { supported: true, power: null };
  }

  // extract all numeric W values and take the max
  const maxWatt = Math.max(...wattMatches.map((w) => parseFloat(w)));

  return {
    supported: true,
    power: { value: maxWatt, unit: "W" },
  };
}

function parseCameraUnits(input: unknown): CameraUnit[] {
  if (typeof input !== "string" || !input.trim()) return [];

  const text = input.toLowerCase();

  const parts = text.split(/\||\+/);

  const results: CameraUnit[] = [];

  for (const part of parts) {
    const mpMatch = part.match(/(\d+)\s*mp/);
    if (!mpMatch) continue;

    const megapixel = Number(mpMatch[1]);

    let position: CameraUnit["position"] = "unknown";
    let type: CameraUnit["type"] = "unknown";

    if (/ultra\s*wide|ultrawide/.test(part)) {
      position = "ultrawide";
      type = "ultrawide";
    } else if (/telephoto|periscope/.test(part)) {
      position = "telephoto";
      type = "telephoto";
    } else if (/macro/.test(part)) {
      position = "macro";
      type = "macro";
    } else if (/depth/.test(part)) {
      position = "depth";
      type = "depth";
    } else if (/wide/.test(part)) {
      position = "main";
      type = "wide";
    }

    results.push({ megapixel, position, type });
  }

  return results;
}

const socDataIntance = SocDataSingleton.getInstance();

function extractDisplay(displayDesc: any): ExtractedDisplay | null {
  if (!displayDesc) return null;

  const DISPLAY_TYPE = [
    {
      type: "LTPO AMOLED",
      score: 10,
      keywords: ["ltpo amoled", "ltpo oled", "proxdr", "pro xdr"],
    },
    {
      type: "Dynamic AMOLED 2X",
      score: 9.5,
      keywords: ["dynamic amoled 2x"],
    },
    {
      type: "Dynamic AMOLED",
      score: 9.2,
      keywords: ["dynamic amoled"],
    },
    {
      type: "Super AMOLED Plus",
      score: 9.0,
      keywords: ["super amoled plus"],
    },
    {
      type: "Super AMOLED",
      score: 8.8,
      keywords: ["super amoled"],
    },
    {
      type: "Fluid AMOLED",
      score: 8.8,
      keywords: ["fluid amoled", "hyperglow"],
    },
    {
      type: "P-OLED",
      score: 8.4,
      keywords: ["p-oled", "poled", "p oled"],
    },
    {
      type: "AMOLED",
      score: 8.0,
      keywords: ["amoled"],
    },
    {
      type: "OLED",
      score: 7.5,
      keywords: ["oled"],
    },
    {
      type: "IPS LCD",
      score: 6.0,
      keywords: ["ips lcd", "ips"],
    },
    {
      type: "PLS LCD",
      score: 5.8,
      keywords: ["pls lcd", "pls"],
    },
    {
      type: "LTPS LCD",
      score: 5.5,
      keywords: ["ltps lcd", "ltps"],
    },
    {
      type: "TFT LCD",
      score: 4.5,
      keywords: ["tft lcd", "tft"],
    },
    {
      type: "LCD", // Being used as static value below
      score: 4.0,
      keywords: ["lcd"],
    },
  ];

  const cleaned = (displayDesc.type ?? "").toLowerCase();
  const displaySpes: ExtractedDisplay = {
    brightness: null,
    resolution: null,
    refreshRate: null,
    ppi: null,
    hdr: { type: null, score: 0 },
    colorDepth: null,
  };

  for (const entry of DISPLAY_TYPE) {
    for (const kw of entry.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(cleaned)) {
        displaySpes.type = { type: entry.type, score: entry.score };
        break;
      }
    }
    if (displaySpes.type) break;
  }

  if (!displaySpes.type && cleaned) {
    const fallbackType = {
      type: "LCD",
      score: 4.0,
      keywords: ["lcd"],
    };
    displaySpes.type = { type: fallbackType.type, score: fallbackType.score };
  }

  const brightnessText = (
    (displayDesc.brightness ?? "") +
    " " +
    (displayDesc.features ?? "")
  ).trim();

  displaySpes.brightness = extractBrightness(brightnessText);

  const { resolution, refreshRate } = parseDisplayResolutionAndRefresh(
    displayDesc.size
  );
  displaySpes.resolution = resolution;
  displaySpes.refreshRate = refreshRate;

  displaySpes.ppi = parsePpiValue(displayDesc.ppi);

  displaySpes.hdr = parseHDR(displayDesc.features);

  displaySpes.colorDepth = parseColorDepth(displayDesc.type);

  return displaySpes;
}

function extractBattery(battery: any): ExtractedBattery {
  const batterySpecs: ExtractedBattery = {
    capacity: null,
    fastCharging: { supported: false, power: null },
  };

  batterySpecs.capacity = parseBatteryCapacity(battery.size);

  batterySpecs.fastCharging = parseFastCharging(battery.fastCharging);
  return batterySpecs;
}

function extractCamera(camera: any): ExtractedCamera {
  const cameraSpecs: ExtractedCamera = {
    rearCamera: [],
    frontCamera: [],
    ois: undefined,
  };
  cameraSpecs.rearCamera = parseCameraUnits(camera.rearCamera);
  cameraSpecs.frontCamera = parseCameraUnits(camera.frontCamera);
  cameraSpecs.ois = camera.ois;
  return cameraSpecs;
}

// MATCH CHIP USING N-GRAM
function matchChipV4(title: string, input: string, minScore = 0.5): boolean {
  return score_v4(title, input) >= minScore;
}

async function extractCPU(technical: any): Promise<ExtractedTechnical> {
  const technicalSpec: ExtractedTechnical = {
    chipset: technical.chipset,
    benchmark: {},
  };
  const socData = await socDataIntance.fetchSocData();
  // Find the best match using score_v4 n-gram approach
  let best: { doc: any; score: number } | null = null;
  for (const doc of socData) {
    if (!doc.title) continue;
    const score = score_v4(doc.title, technicalSpec.chipset);
    // Consider a threshold, e.g. 0.7 or pick best score > 0.6
    if (score > 0.6 && (!best || score > best?.score)) {
      best = { doc, score };
    }
  }
  const chipData = best?.doc;

  const antutu = chipData?.antutu ? { ...chipData.antutu } : null;

  // Convert "Total score" to "totalScore" in breakdown
  if (antutu?.breakdown && "Total score" in antutu.breakdown) {
    antutu.breakdown.totalScore = antutu.breakdown["Total score"];
    delete antutu.breakdown["Total score"];
  }

  technicalSpec.benchmark = {
    antutu: antutu,
    geekbench: chipData?.geekbench || null,
  };
  return technicalSpec;
}

export async function normalizeSpecs(
  specsObj: FullSpecsResult
): Promise<FullSpecsResult & { extracted: ExtractedSpecs }> {
  const result = structuredClone(specsObj) as FullSpecsResult & {
    extracted: ExtractedSpecs;
  };
  result.extracted = {};

  if (result.specs?.display) {
    const disp = extractDisplay(result.specs.display);
    if (disp) {
      result.extracted.display = disp;
    }
  }

  if (result.specs?.battery) {
    result.extracted.battery = extractBattery(result.specs.battery);
  }

  if (result.specs?.camera) {
    result.extracted.camera = extractCamera(result.specs.camera);
  }

  if (result.specs?.technical) {
    result.extracted.technical = await extractCPU(result.specs.technical);
  }

  return result;
}
