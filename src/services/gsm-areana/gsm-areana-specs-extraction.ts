// ---------- TYPES ----------
type ValueUnit = { value: number; unit: string };

interface ChipsetInfo {
  block: string;
  processName: string | null;
  processNode: ValueUnit | null;
}

interface CpuCluster {
  cores: number;
  freq: ValueUnit | null;
  arch: string | null;
}

interface CpuInfo {
  cpuType: string | null;
  clusters: CpuCluster[];
  block: string;
}

interface GpuInfo {
  gpuName: string | null;
  cores: string | null;
  frequency: ValueUnit | null;
  block: string;
}

interface DisplayInfo {
  displayType: string | null;
  refreshRate: ValueUnit | null;
  pwm: ValueUnit | null;
  brightness: {
    typ: ValueUnit | null;
    hbm: ValueUnit | null;
    peak: ValueUnit | null;
    others: ValueUnit[];
  };
  extras: string[];
  raw: string;
}

interface ResolutionInfo {
  resolution: { width: number; height: number } | null;
  aspectRatio: string | null;
  ppi: ValueUnit | null;
  raw: string;
}

interface CameraModule {
  raw: string;
  megapixel: ValueUnit | null;
  aperture: number | null;
  focal: ValueUnit | null;
  lensType: string | null;
  category: string;
  sensorSize: string | null;
  pixelSize: ValueUnit | null;
  features: string[] | null;
}

interface CameraInfo {
  main: CameraModule;
  secondary: CameraModule[];
  others: CameraModule[];
  raw: string;
}

interface BatteryInfo {
  chemistry: string | null;
  capacity: ValueUnit;
  region: string | null;
}

interface ChargingInfo {
  wired: ValueUnit | null;
  wireless: ValueUnit | null;
  reverseWired: ValueUnit | null;
  reverseWireless: ValueUnit | null;
  fastest: ValueUnit | null;
  raw: string;
}

// ---------- CLASS ----------
export class SpecParser {
  spec: any;

  constructor(spec: any) {
    this.spec = spec;
  }

  parseChipsetString(str: string): ChipsetInfo | null {
    const BLOCK_RE = /([^,]+?\(\s*\d+(?:\.\d+)?\s*nm\s*\)[^,]*)/gi;
    const NAME_RE = /^(.+?)\(\s*\d/i;
    const NODE_RE = /(\d+(?:\.\d+)?)(?:\s*)(nm)\b/i;

    const blocks: ChipsetInfo[] = [];
    let m: RegExpExecArray | null;

    while ((m = BLOCK_RE.exec(str)) !== null) {
      const block = m[1].trim();
      const nameMatch = NAME_RE.exec(block);
      const processName = nameMatch ? nameMatch[1].trim() : null;
      const nodeMatch = NODE_RE.exec(block);
      const processNode = nodeMatch
        ? { value: parseFloat(nodeMatch[1]), unit: nodeMatch[2] }
        : null;

      blocks.push({ block, processName, processNode });
    }

    const india = blocks.find((b) => /india/i.test(b.block));
    return india || blocks[0] || null;
  }

  parseCpu(raw: string): CpuInfo | null {
    const BLOCK_RE = /(?:Octa|Hexa|Quad|10|8)-core[^,]+/gi;
    const blocks = raw.match(BLOCK_RE) || [];
    const chosen = blocks.find((b) => /india/i.test(b)) || blocks[0] || null;
    if (!chosen) return null;

    const cpuTypeMatch = /^([A-Za-z0-9-]+core)/i.exec(chosen);
    const cpuType = cpuTypeMatch ? cpuTypeMatch[1] : null;

    const CLUSTER_RE =
      /(\d+)x\s*(\d+(?:\.\d+)?)?\s*(GHz)?\s*([A-Za-z0-9\-]+)?/gi;

    const clusters: CpuCluster[] = [];
    let m: RegExpExecArray | null;

    while ((m = CLUSTER_RE.exec(chosen)) !== null) {
      const cores = parseInt(m[1]);
      const freq = m[2]
        ? { value: parseFloat(m[2]), unit: m[3] || "GHz" }
        : null;
      const arch = m[4] || null;
      clusters.push({ cores, freq, arch });
    }

    return { cpuType, clusters, block: chosen };
  }

  parseGpu(raw: string): GpuInfo | null {
    const BLOCK_RE = /(?:Mali|Adreno|Apple|IMG|Xclipse)[^,]+/gi;
    const blocks = raw.match(BLOCK_RE) || [];
    const chosen = blocks.find((b) => /india/i.test(b)) || blocks[0] || null;
    if (!chosen) return null;

    const gpu = chosen.trim();

    const NAME_RE =
      /^(Mali[- ]?[A-Za-z0-9\-]+|Adreno\s*\d+|Apple GPU|IMG\s*[A-Za-z0-9\-]+|Xclipse\s*\d+)/i;
    const coreMatch = /\b(MC\d+|MP\d+|\d+-core)\b/i.exec(gpu);
    const freqMatch = /(\d+(?:\.\d+)?)(?:\s*)(GHz|MHz)\b/i.exec(gpu);

    const nameMatch = NAME_RE.exec(gpu);

    return {
      gpuName: nameMatch ? nameMatch[1].trim() : null,
      cores: coreMatch ? coreMatch[1] : null,
      frequency: freqMatch
        ? { value: parseFloat(freqMatch[1]), unit: freqMatch[2] }
        : null,
      block: gpu,
    };
  }

  parseDisplay(raw: string): DisplayInfo {
    const str = raw.trim();
    const displayType = str.split(",")[0].trim() || null;

    const REFRESH_RE = /(\d+(?:\.\d+)?)\s*(Hz)\b/i;
    const PWM_RE = /(\d+(?:\.\d+)?)\s*(Hz)\s*PWM/i;
    const NITS_RE = /(\d+(?:\.\d+)?)\s*nits(?:\s*\(([^)]+)\))?/gi;

    const refreshMatch = REFRESH_RE.exec(str);
    const pwmMatch = PWM_RE.exec(str);

    const brightness = {
      typ: null as ValueUnit | null,
      hbm: null as ValueUnit | null,
      peak: null as ValueUnit | null,
      others: [] as ValueUnit[],
    };

    let m: RegExpExecArray | null;
    while ((m = NITS_RE.exec(str)) !== null) {
      const val: ValueUnit = { value: parseFloat(m[1]), unit: "nits" };
      const label = m[2]?.toLowerCase() || null;
      if (label?.includes("typ")) brightness.typ = val;
      else if (label?.includes("hbm")) brightness.hbm = val;
      else if (label?.includes("peak")) brightness.peak = val;
      else brightness.others.push(val);
    }

    const parts = str.split(",").map((s) => s.trim());
    const extras = parts.filter(
      (p) =>
        !REFRESH_RE.test(p) &&
        !PWM_RE.test(p) &&
        !/nits/i.test(p) &&
        p !== displayType
    );

    return {
      displayType,
      refreshRate: refreshMatch
        ? { value: parseFloat(refreshMatch[1]), unit: refreshMatch[2] }
        : null,
      pwm: pwmMatch
        ? { value: parseFloat(pwmMatch[1]), unit: pwmMatch[2] }
        : null,
      brightness,
      extras,
      raw,
    };
  }

  parseResolution(raw: string): ResolutionInfo {
    const str = raw.trim();

    const resMatch = /(\d+)\s*x\s*(\d+)/i.exec(str);
    const ratioMatch = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/i.exec(str);
    const ppiMatch = /(\d+(?:\.\d+)?)\s*ppi/i.exec(str);

    return {
      resolution: resMatch
        ? { width: parseInt(resMatch[1]), height: parseInt(resMatch[2]) }
        : null,
      aspectRatio: ratioMatch ? ratioMatch[0] : null,
      ppi: ppiMatch ? { value: parseFloat(ppiMatch[1]), unit: "ppi" } : null,
      raw,
    };
  }

  parseCamera(raw: string): CameraInfo {
    const str = raw.trim();
    const MODULE_RE = /(\d+\s*MP\b[\s\S]*?(?=\d+\s*MP\b|$))/gi;

    const modules: string[] = [];
    let blk: RegExpExecArray | null;

    while ((blk = MODULE_RE.exec(str)) !== null) modules.push(blk[1].trim());
    if (modules.length === 0) modules.push(str);

    const parsed: CameraModule[] = modules.map((m) => {
      const MP_RE = /(\d+)\s*MP/i;
      const AP_RE = /f\/(\d+(\.\d+)?)/i;
      const FL_RE = /(\d+(?:\.\d+)?)\s*mm/i;
      const TYPE_RE =
        /\b(wide|ultrawide|telephoto|periscope telephoto|macro)\b/i;
      const SS_RE = /(\d+\/\d+(?:\.\d+)?)/;
      const PIX_RE = /(\d+(?:\.\d+)?)\s*µm/i;

      const mp = MP_RE.exec(m);
      const megapixel = mp
        ? { value: parseInt(mp[1]), unit: "MP" as const }
        : null;

      const aperture = AP_RE.exec(m);
      const focal = FL_RE.exec(m);
      const type = TYPE_RE.exec(m);
      const pixel = PIX_RE.exec(m);
      const ss = SS_RE.exec(m);

      let category = "other";
      const lensType = type ? type[1].toLowerCase() : null;
      if (/wide/i.test(lensType || "")) category = "wide";
      else if (/ultra/i.test(lensType || "")) category = "ultrawide";
      else if (/tele/i.test(lensType || "")) category = "telephoto";
      else if (/macro/i.test(lensType || "")) category = "macro";

      const FEATURES = [
        "dual pixel PDAF",
        "multi-directional PDAF",
        "sensor-shift OIS",
        "optical zoom",
        "Super Steady video",
        "PDAF",
        "OIS",
        "AF",
      ];
      const features = FEATURES.filter((f) => new RegExp(f, "i").test(m));
      const finalFeatures = features.length ? features : null;

      return {
        raw: m,
        megapixel,
        aperture: aperture ? parseFloat(aperture[1]) : null,
        focal: focal ? { value: parseFloat(focal[1]), unit: "mm" } : null,
        lensType,
        category,
        sensorSize: ss ? ss[1] : null,
        pixelSize: pixel ? { value: parseFloat(pixel[1]), unit: "µm" } : null,
        features: finalFeatures,
      };
    });

    let main = parsed.slice().sort((a, b) => {
      return (b.megapixel?.value || 0) - (a.megapixel?.value || 0);
    })[0];

    const highest = main.megapixel?.value;
    const tied = parsed.filter((m) => (m.megapixel?.value || 0) === highest);
    const wideTied = tied.find((t) => t.category === "wide");
    if (wideTied) main = wideTied;

    const secondary = parsed.filter(
      (m) =>
        m !== main && ["wide", "ultrawide", "telephoto"].includes(m.category)
    );

    const others = parsed.filter((m) => m !== main && !secondary.includes(m));

    return { main, secondary, others, raw };
  }

  extractBattery(raw: string): BatteryInfo | null {
    const BLOCK_RE = /([A-Za-z0-9\/\-\s]*?)?(\d+(?:\.\d+)?)\s*mAh([^·]*)/gi;
    const str = raw.trim();

    const blocks: BatteryInfo[] = [];
    let m: RegExpExecArray | null;

    while ((m = BLOCK_RE.exec(str)) !== null) {
      const chemistry = m[1]?.trim() || null;
      const value = parseFloat(m[2]);
      const tail = m[3] || "";
      const region = /india/i.test(tail)
        ? "india"
        : /global/i.test(tail)
        ? "global"
        : /international/i.test(tail)
        ? "international"
        : null;

      blocks.push({
        chemistry,
        capacity: { value, unit: "mAh" },
        region,
      });
    }

    if (blocks.length > 1) {
      const india = blocks.find((b) => b.region === "india");
      if (india) return india;
    }

    return blocks[0] || null;
  }

  extractCharging(raw: string): ChargingInfo {
    const str = raw.trim();
    let text = str;

    if (/india/i.test(str)) {
      const parts = str.split(/(?=\d+W)/i);
      const indiaVersion = parts.find((p) => /india/i.test(p));
      if (indiaVersion) text = indiaVersion;
    }

    const W_RE_GLOBAL = /(\d+(?:\.\d+)?)\s*W\b/gi;
    const wiredRe = /(\d+(?:\.\d+)?)\s*W\s*wired/i;
    const wirelessRe = /(\d+(?:\.\d+)?)\s*W\s*wireless/i;
    const reverseWiredRe = /(\d+(?:\.\d+)?)\s*W\s*reverse\s*wired/i;
    const reverseWirelessRe = /(\d+(?:\.\d+)?)\s*W\s*reverse\s*wireless/i;

    const allW: number[] = [];

    let wm: RegExpExecArray | null;
    while ((wm = W_RE_GLOBAL.exec(text)) !== null) {
      allW.push(parseFloat(wm[1]));
    }

    const wired = wiredRe.exec(text);
    const wireless = wirelessRe.exec(text);
    const reverseWired = reverseWiredRe.exec(text);
    const reverseWireless = reverseWirelessRe.exec(text);

    return {
      wired: wired ? { value: parseFloat(wired[1]), unit: "W" } : null,
      wireless: wireless ? { value: parseFloat(wireless[1]), unit: "W" } : null,
      reverseWired: reverseWired
        ? { value: parseFloat(reverseWired[1]), unit: "W" }
        : null,
      reverseWireless: reverseWireless
        ? { value: parseFloat(reverseWireless[1]), unit: "W" }
        : null,
      fastest: allW.length ? { value: Math.max(...allW), unit: "W" } : null,
      raw,
    };
  }

  process() {
    const s = this.spec;

    return {
      raw: s,
      processed: {
        chipset: this.parseChipsetString(s.platform?.chipset || ""),
        cpu: this.parseCpu(s.platform?.cpu || ""),
        gpu: this.parseGpu(s.platform?.gpu || ""),
        display: this.parseDisplay(s.display?.type || ""),
        resolution: this.parseResolution(s.display?.resolution || ""),
        mainCamera: this.parseCamera(
          s.main_camera?.dual ||
            s.main_camera?.triple ||
            s.main_camera?.quad ||
            s.main_camera?.single ||
            ""
        ),
        selfieCamera: this.parseCamera(s.selfie_camera?.single || ""),
        battery: this.extractBattery(s.battery?.type || ""),
        charging: this.extractCharging(s.battery?.charging || ""),
      },
    };
  }
}
