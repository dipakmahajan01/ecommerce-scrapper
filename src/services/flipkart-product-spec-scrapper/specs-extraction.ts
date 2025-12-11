export class SpecExtractor {
  // ------------------ BATTERY ------------------
  static extractBattery(input: string) {
    const m = input.match(/(\d{3,5})\s*(mAh|mah|MAH)?/i);
    if (!m) return null;

    return {
      value: Number(m[1]),
      unit: m[2] ? m[2] : null,
    };
  }

  // ------------------ DISPLAY ------------------
  static extractDisplay(d: Record<string, string>) {
    const DISPLAY_TYPE_RE =
      /\b(?:AMOLED|Super AMOLED|Dynamic AMOLED 2X|pOLED|OLED|LTPS LCD|LCD|AMOLED Flexible)\b/i;

    const RESOLUTION_RE = /(\d{3,4})\s*[:xX\*]\s*(\d{3,4})/;

    const REFRESH_RE = /(\d{2,3})\s*Hz/i;

    const BRIGHTNESS_RE = /(\d{3,4})\s*nits?/i;

    const HDR_RE = /\bHDR10\+?|HDR\s*Support\b/i;

    const COLOR_DEPTH_RE =
      /\b(\d+(\.\d+)?\s*(Million|Billion)\+?|\d+\s*Bit)\b/i;

    const full = Object.values(d).join(" ");

    const type = d["Display Type"]?.match(DISPLAY_TYPE_RE)?.[0] || null;

    const resRaw = d["Resolution"] || "";
    const resMatch = resRaw.match(RESOLUTION_RE);
    const resolution = resMatch ? `${resMatch[1]}x${resMatch[2]}` : null;

    const hz = full.match(REFRESH_RE);
    const refreshRate = hz ? Number(hz[1]) : null;

    const bright = full.match(BRIGHTNESS_RE);
    const brightness = bright ? Number(bright[1]) : null;

    const hdrMatch = full.match(HDR_RE);
    const hdr = hdrMatch ? hdrMatch[0] : null;

    const colorMatch = full.match(COLOR_DEPTH_RE);
    const colorDepth = colorMatch ? colorMatch[0] : null;

    return {
      type,
      resolution,
      refreshRate,
      brightness,
      hdr,
      colorDepth,
    };
  }

  // ------------------ CPU ------------------
  static extractCPU(d: Record<string, string>) {
    const CPU_TYPE_RE =
      /\b(?:Snapdragon|Exynos|Mediatek|MediaTek|Google|Tensor|Dimensity|T\d+|[0-9]+(?:\s*Gen\s*[0-9]+)?(?:\s*5G)?)\s*[A-Za-z0-9\.\+\-\s]*/i;

    const CLOCK_RE = /(\d+(?:\.\d+)?)\s*GHz/gi;

    const full = Object.values(d).join(" ");

    const brand = d["Processor Brand"];

    const typeRaw = d["Processor Type"] || "";
    const typeMatch = typeRaw.match(CPU_TYPE_RE);
    const type = typeMatch ? typeMatch[0].trim() : null;

    const clocks = [...full.matchAll(CLOCK_RE)].map((m) => Number(m[1]));

    return {
      brand,
      type,
      clocks,
    };
  }

  // ------------------ CAMERA ------------------
  static extractCamera(d: Record<string, string>) {
    const MP_RE = /(\d+(?:\.\d+)?)\s*MP/gi;

    const primaryRaw = d["Primary Camera"] || "";
    const secondaryRaw = d["Secondary Camera"] || "";

    const primaryExists =
      d["Primary Camera Available"]?.toLowerCase() === "yes" ||
      Boolean(primaryRaw);

    const primaryMPMatches = [...primaryRaw.matchAll(MP_RE)].map((m) =>
      Number(m[1])
    );
    const primaryMP = primaryMPMatches.length ? primaryMPMatches : null;

    const secondaryExists =
      d["Secondary Camera Available"]?.toLowerCase() === "yes" ||
      Boolean(secondaryRaw);

    const secondaryMPMatches = [...secondaryRaw.matchAll(MP_RE)].map((m) =>
      Number(m[1])
    );
    const secondaryMP = secondaryMPMatches.length ? secondaryMPMatches : null;

    return {
      primaryExists,
      primaryMP,
      secondaryExists,
      secondaryMP,
    };
  }

  // ------------------ NORMALIZER ------------------
  static normalize(raw: any) {
    const grouped: Record<string, Record<string, string>> = {};

    for (const block of raw.specs || []) {
      if (!grouped[block.title]) grouped[block.title] = {};
      for (const d of block.details) {
        grouped[block.title][d.property] = d.value;
      }
    }

    return {
      battery: grouped["Battery & Power Features"]
        ? SpecExtractor.extractBattery(
            grouped["Battery & Power Features"]["Battery Capacity"] || ""
          )
        : null,
      batteryRaw: grouped["Battery & Power Features"]
        ? { ...grouped["Battery & Power Features"] }
        : null,

      display: SpecExtractor.extractDisplay(grouped["Display Features"] || {}),
      displayRaw: grouped["Display Features"]
        ? { ...grouped["Display Features"] }
        : null,

      cpu: SpecExtractor.extractCPU(grouped["Os & Processor Features"] || {}),
      cpuRaw: grouped["Os & Processor Features"]
        ? { ...grouped["Os & Processor Features"] }
        : null,

      camera: SpecExtractor.extractCamera(grouped["Camera Features"] || {}),
      cameraRaw: grouped["Camera Features"]
        ? { ...grouped["Camera Features"] }
        : null,
    };
  }
}
