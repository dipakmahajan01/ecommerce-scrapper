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
export type ExtractedTechnical = {
  chipset: string;
  geekbench: Record<string, unknown>; // As per structure of .antutu
};

// All extracted values type
export type ExtractedSpecs = {
  display?: ExtractedDisplay;
  battery?: ExtractedBattery;
  camera?: ExtractedCamera;
  technical?: ExtractedTechnical;
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ""); // kill spaces, dashes, everything
}

function matchChip(title: string, input: string): boolean {
  return norm(title).includes(norm(input));
}

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
      type: "Micro-LED",
      score: 10,
      keywords: ["micro-led", "micro led", "microled"],
    },
    { type: "QD-OLED", score: 9, keywords: ["qd-oled", "qd oled"] },
    {
      type: "Micro-OLED",
      score: 9,
      keywords: ["micro-oled", "micro oled", "microoled"],
    },

    {
      type: "Dynamic AMOLED 2X",
      score: 8.6,
      keywords: ["dynamic amoled 2x"],
    },
    { type: "Dynamic AMOLED", score: 8.5, keywords: ["dynamic amoled"] },
    {
      type: "Super AMOLED Plus",
      score: 8.3,
      keywords: ["super amoled plus"],
    },
    { type: "Super AMOLED", score: 8, keywords: ["super amoled"] },
    { type: "Fluid AMOLED", score: 8, keywords: ["fluid amoled"] },

    { type: "Flexible OLED", score: 7.7, keywords: ["flexible oled"] },
    { type: "P-OLED", score: 7.2, keywords: ["p-oled", "poled", "p oled"] },
    { type: "AMOLED", score: 7, keywords: ["amoled"] },
    { type: "OLED", score: 6, keywords: ["oled"] },

    {
      type: "Mini-LED LCD",
      score: 5,
      keywords: ["mini-led lcd", "mini led lcd", "mini-led"],
    },
    { type: "LTPS LCD", score: 4, keywords: ["ltps lcd"] },
    { type: "PLS LCD", score: 3.2, keywords: ["pls lcd"] },
    { type: "IPS LCD", score: 3, keywords: ["ips lcd"] },
    { type: "TFT LCD", score: 2, keywords: ["tft lcd", "tft"] },
    { type: "STN LCD", score: 1, keywords: ["stn lcd", "stn"] },

    { type: "LCD", score: 1.5, keywords: ["lcd"] },
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

async function extractCPU(technical: any): Promise<ExtractedTechnical> {
  const technicalSpec: ExtractedTechnical = {
    chipset: technical.chipset,
    geekbench: {},
  };
  const socData = await socDataIntance.fetchSocData();
  const chipData = socData.find((doc) => {
    if (!doc.title) return false;
    console.log("VAL", doc.title, technicalSpec.chipset);
    return matchChip(doc.title, technicalSpec.chipset);
  });
  technicalSpec.geekbench = {
    ...chipData?.antutu,
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

// Soft geekbench and antutu score
// sorting algo
