import { URLSearchParams } from "url";
import { ParsedQuery } from "./nlp";


export function buildFlipkartSearchUrl(parsed: ParsedQuery): string {
  const params = new URLSearchParams({
    q: parsed.productKeywords,
    otracker: "search",
    otracker1: "search",
    marketplace: "FLIPKART",
    "as-show": "on",
    as: "off",
  });

  // If you later reverse‑engineer Flipkart’s min/max price params,
  // you can add them here based on parsed.minPrice / parsed.maxPrice.

  return `https://www.flipkart.com/search?${params.toString()}`;
}