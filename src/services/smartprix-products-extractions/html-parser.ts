import * as cheerio from "cheerio";
import type { Element as CheerioElement } from "domhandler";

export type SpecSectionObject = Record<string, string>;
export type SpecsObject = Record<string, SpecSectionObject>;
type RowKV = { label: string; value: string };
export type Lifecycle =
  | "rumored"
  | "upcoming"
  | "considerable"
  | "outdated"
  | "unknown";

export type FullSpecsResult = {
  meta: {
    brand?: string;
    model?: string;
    lifecycle: Lifecycle;
    variants: { name: string; link: string }[];
    releaseDate: string | null;
    releaseStatus: string | null;
  };
  specs: SpecsObject;
};

const cleanText = (text?: string | null): string =>
  (text ?? "").replace(/\s+/g, " ").trim();

const toCamelKey = (raw: string): string => {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return "";

  const parts = cleaned.split(" ").filter(Boolean);
  if (!parts.length) return "";

  const [first, ...rest] = parts;
  let key = first;
  const camelRest = rest
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  key += camelRest;

  if (/^[0-9]/.test(key)) {
    key = "_" + key;
  }
  return key;
};

const extractRowsFromTable = (
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<CheerioElement>
): RowKV[] => {
  const rows: RowKV[] = [];

  table.find("tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length < 2) return;

    // Smartprix often puts the label in a <td> with a "title" class
    const labelEl = $(cells[0]);
    const label = cleanText(labelEl.text());

    // For value processing: flatten all the HTML (to preserve <br> split points, etc)
    // and collect text, splitting on <br> or <br class="l">
    let valueRawHtml = "";
    cells.slice(1).each((__, cell) => {
      // Collect raw HTML so we can parse <br> and inline spans
      valueRawHtml += $(cell).html() ?? "";
    });

    // Replace <br> (or <br class="l">) with a unique splitter, then extract text segments
    // Also, remove comment nodes (e.g. <!---->)
    valueRawHtml = valueRawHtml
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br[^>]*?>/gi, "|||");

    // .text() removes <span>, so manually extract text from html
    // But still clean the text and join on the break marker
    const tempDiv = $("<div>").html(valueRawHtml);

    // For segments, split on our marker
    const rawSegments = tempDiv.text().split("|||");
    const valueParts: string[] = [];
    for (const segment of rawSegments) {
      const txt = cleanText(segment);
      if (txt) valueParts.push(txt);
    }

    const value = cleanText(valueParts.join(" | ")); // Use delimiter to keep separation, e.g. for Rear Camera

    if (!label && !value) return;

    rows.push({ label, value });
  });

  return rows;
};

/**
 * Build a "sectionName -> { fieldKey: value }" object from the
 * Smartprix "Full Specs" area. This is generic and works across
 * different phones/brands as long as the section+table structure is kept.
 */
const extractSpecsObject = ($: cheerio.CheerioAPI): SpecsObject => {
  const specs: SpecsObject = {};

  const specsContainers = $(".sm-fullspecs")
    .first()
    .children(".sm-fullspecs-grp");

  specsContainers.each((_, sectionGrp) => {
    const group = $(sectionGrp);

    const sectionTitleEl = group.children(".title").first();
    const sectionTitle = cleanText(sectionTitleEl.text());
    if (!sectionTitle) return;

    const sectionKey = toCamelKey(sectionTitle);
    if (!sectionKey) return;

    const table = group.find("table").first();
    if (!table.length) return;

    const rows = extractRowsFromTable($, table);
    if (!rows.length) return;

    if (!specs[sectionKey]) {
      specs[sectionKey] = {};
    }
    const sectionObj = specs[sectionKey];

    for (const { label, value } of rows) {
      const fieldKey = toCamelKey(label);
      if (!fieldKey) continue;

      if (sectionObj[fieldKey]) {
        sectionObj[fieldKey] = `${sectionObj[fieldKey]} | ${value}`;
      } else {
        sectionObj[fieldKey] = value;
      }
    }
  });

  return specs;
};

/**
 * Extracts the available variants and their prices from Smartprix's product page HTML.
 * Looks for boxes in the `.sm-variants` container: each box contains an <a> with the variant name,
 * and a <span> with the price (e.g. ₹33,710).
 *
 * Returns an array of objects: { name: string, price: number, link: string }
 */
export function extractSmartprixVariants(
  $: cheerio.CheerioAPI
): Array<{ name: string; link: string }> {
  const variants: Array<{ name: string; link: string }> = [];
  $(".sm-variants .active, .sm-variants > div").each((_, el) => {
    const box = $(el);
    const a = box.find("a").first();
    const name = cleanText(a.text());
    let link = a.attr("href") || "";
    if (link && !link.startsWith("http")) {
      link = "https://www.smartprix.com" + link;
    }
    // Only push if name exists
    if (name) {
      variants.push({ name, link });
    }
  });
  return variants;
}

export function extractReleaseStatus($: cheerio.CheerioAPI): string {
  const liner = $(".pg-prd-head .liner").first();
  const text = liner.text().replace(/\s+/g, " ").trim();
  return text;
}

export function getSmartprixLifecycle(
  releaseStatus: string | null,
  releaseDateRaw: string | undefined | null
): Lifecycle {
  // Check release status for special keywords
  const status = (releaseStatus || "").toLowerCase();
  console.log("ReleaseStatus", releaseDateRaw, releaseStatus);
  if (/rumou?red/.test(status)) {
    return "rumored"; // or a special value if you want
  }
  if (/coming soon|comming soon|upcoming|expected/.test(status)) {
    return "upcoming";
  }

  if (
    !releaseDateRaw ||
    typeof releaseDateRaw !== "string" ||
    !releaseDateRaw.trim()
  ) {
    return "unknown";
  }

  // Attempt basic parsing, being forgiving of format
  let releaseDate: Date | null = null;

  // Clean up date string
  const cleanedDate = releaseDateRaw
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/(about|expected|released|announced|,)/gi, "")
    .trim();

  // Try built-in Date parser
  const dateFromString = Date.parse(cleanedDate);
  if (!isNaN(dateFromString)) {
    releaseDate = new Date(dateFromString);
  }

  if (!releaseDate || isNaN(releaseDate.getTime())) {
    return "unknown";
  }

  // Compute age
  const now = new Date();
  const msInYear = 1000 * 60 * 60 * 24 * 365.25;
  const diffYears = (now.getTime() - releaseDate.getTime()) / msInYear;

  if (diffYears < 0) {
    // Release date is in the future, treat as upcoming
    return "upcoming";
  } else if (diffYears < 2) {
    return "considerable";
  } else if (diffYears >= 2) {
    return "outdated";
  }

  return "unknown";
}

export const parseSmartprixPhoneSpecs = (
  html: string,
  brand: string
): FullSpecsResult => {
  const $ = cheerio.load(html);

  const meta: FullSpecsResult["meta"] = {
    brand: brand,
    variants: [],
    lifecycle: "unknown",
    releaseStatus: null,
    releaseDate: null,
  };

  const releaseStatus = extractReleaseStatus($);
  meta.variants = extractSmartprixVariants($);
  const specs = extractSpecsObject($);
  console.log("ReleaseStatus", specs.general.model);
  meta.lifecycle = getSmartprixLifecycle(
    releaseStatus,
    specs.general?.releaseDate ?? null
  );
  meta.releaseStatus = releaseStatus;
  meta.releaseDate = specs.general?.releaseDate ?? "NOT FOUND";

  return { meta, specs };
};

/**
 * Example usage:
 *
 * const html = await fetchSmartprixHtml(url);
 * const result = parseSmartprixPhoneSpecs(html);
 *
 * console.log(result.meta.brand); // "Samsung"
 * console.log(result.meta.model); // "Samsung Galaxy S24 FE 5G"
 * console.log(result.specs.display?.size); // e.g. "6.7 inches, 1080 x 2340 pixels, 120 Hz"
 */
