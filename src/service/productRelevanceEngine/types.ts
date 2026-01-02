// =====================
// General Spec Types
// =====================
export type SpecSectionObject = Record<string, string>;
export type SpecsObject = Record<string, SpecSectionObject>;

export type Lifecycle =
  | "rumored"
  | "upcoming"
  | "considerable"
  | "outdated"
  | "unknown";

export type Variant = {
  name: string;
  link: string;
};

// =====================
// Result Types
// =====================
export type FullSpecsResult = {
  meta: {
    brand?: string;
    model?: string;
    lifecycle: Lifecycle;
    variants: Variant[];
    releaseDate: string | null;
    releaseStatus: string | null;
  };
  specs: SpecsObject;
};

export type SmartPrixRecord = {
  link: string;
  title: string;
  brand?: string;
  success: boolean;
  html?: string;
  parseHtmlSpec: FullSpecsResult;
  normalizedSpecs: FullSpecsResult & { extracted: ExtractedSpecs };
  createdAt?: Date;
  updatedAt?: Date;
};

// =====================
// Extracted Value Types
// =====================

// ---- Display ----
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

// ---- Battery ----
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

// ---- Camera ----
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

// ---- Technical/CPU ----
export type GeekbenchBreakdown = {
  CPU: string;
  GPU: string;
  Memory: string;
  UX: string;
  "Total score"?: string; // TODO: fix this
  [key: string]: string | undefined;
};

export type Geekbench = {
  total: string;
  breakdown: GeekbenchBreakdown;
  [key: string]: unknown;
};

export type ExtractedTechnical = {
  chipset: string;
  geekbench: Geekbench;
};

// ---- Combined Extracted Specs ----
export type ExtractedSpecs = {
  display: ExtractedDisplay;
  battery: ExtractedBattery;
  camera: ExtractedCamera;
  technical: ExtractedTechnical;
};

// =====================
// Scoring Types
// =====================

export type StatKey =
  | "brightness"
  | "displayResolution"
  | "displayType"
  | "refreshRate"
  | "ppi"
  | "capacity"
  | "rearMp"
  | "frontMp"
  | "cpu"
  | "gpu";

export type Score = Partial<Record<StatKey, number | null>> &
  Partial<{ total: number }>;

// =====================
// Category Scoring Types
// =====================

export type CategoryWeights = {
  batteryEndurance: number;
  // softwareExperience: number;
  displayQuality: number;
  cpuPerformance: number;
  gpuPerformance: number;
  cameraQuality: number;
};

export type CategoryScore = {
  category: string;
  rawScore: number; // Normalized score (0-1)
  weightedScore: number; // rawScore * weight
};

export type ProductCategoryScores = {
  batteryEndurance: CategoryScore;
  // softwareExperience: CategoryScore;
  displayQuality: CategoryScore;
  cpuPerformance: CategoryScore;
  gpuPerformance: CategoryScore;
  cameraQuality: CategoryScore;
  totalWeightedScore: number;
};

/**
 * Normalization context with pre-calculated min/max values for performance
 */
export type NormalizationContext = {
  batteryCapacity: { min: number; max: number };
  // softwareScore: { min: number; max: number };
  displayType: { min: number; max: number };
  displayPpi: { min: number; max: number };
  displayRefreshRate: { min: number; max: number };
  displayBrightness: { min: number; max: number };
  // displayHdr: { min: number; max: number };
  cpuScore: { min: number; max: number };
  gpuScore: { min: number; max: number };
  cameraMainMp: { min: number; max: number };
  // cameraCount: { min: number; max: number };
};

export interface CategoryProcessor {
  process(product: SmartPrixRecord, context: NormalizationContext): number; // Returns normalized score (0-1), must be between 0-1
  getCategoryName(): string;
  prepareContext(allProducts: SmartPrixRecord[]): Partial<NormalizationContext>;
  validateProduct(product: SmartPrixRecord): boolean; // Returns true if product has required data for this processor
}
