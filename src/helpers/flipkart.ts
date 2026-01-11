import { ParsedQuery } from "./aiParser";

export function buildFlipkartSearchUrl(parsed: ParsedQuery): string {
  const hasFilters =
    parsed.maxPrice !== null ||
    parsed.minPrice !== null ||
    (parsed.brands !== null && parsed.brands.length > 0) ||
    parsed.storage !== null ||
    (parsed.ram !== null && parsed.ram.length > 0);

  const params = new URLSearchParams();
  params.append("q", parsed.query);

  if (!hasFilters) {
    params.append("marketplace", "FLIPKART");
    params.append("as-show", "on");
    params.append("as", "off");
    return `https://www.flipkart.com/search?${params.toString()}`;
  }

  params.append("sid", "tyy,4io");

  if (parsed.minPrice !== null) {
    params.append("p[]", `facets.price_range.from=${parsed.minPrice}`);
  }

  if (parsed.maxPrice !== null) {
    params.append("p[]", `facets.price_range.to=${parsed.maxPrice}`);
  }

  if (parsed.brands !== null && parsed.brands.length > 0) {
    for (const brand of parsed.brands) {
      params.append("p[]", `facets.brand[]=${brand}`);
    }
  }

  if (parsed.storage !== null) {
    params.append("p[]", `facets.internal_storage[]=${parsed.storage}`);
  }

  if (parsed.ram !== null && parsed.ram.length > 0) {
    for (const ram of parsed.ram) {
      params.append("p[]", `facets.ram[]=${ram}`);
    }
  }

  return `https://www.flipkart.com/search?${params.toString()}`;
}
