// src/nlp.ts
export interface ParsedQuery {
  raw: string;
  productKeywords: string;
  maxPrice?: number;
  minPrice?: number;
}

export function parseUserQuery(raw: string): ParsedQuery {
  const lower = raw.toLowerCase();

  // price patterns like "under 10000", "below 15k", "between 5000 and 10000"
  const underMatch = lower.match(/(under|below)\s*([\d,]+k?)/);
  const betweenMatch = lower.match(/between\s*([\d,]+k?)\s*(and|to|-)\s*([\d,]+k?)/);

  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  const normalizeNumber = (v: string) => {
    let n = v.replace(/,/g, "").trim();
    if (n.endsWith("k")) {
      return parseInt(n) * 1000;
    }
    return parseInt(n);
  };

  if (underMatch) {
    maxPrice = normalizeNumber(underMatch[2]);
  } else if (betweenMatch) {
    minPrice = normalizeNumber(betweenMatch[1]);
    maxPrice = normalizeNumber(betweenMatch[3]);
  }

  // crude removal of price phrases to get product keywords
  let product = lower
    .replace(/i want|i need|show me|find me|looking for/g, "")
    .replace(/under\s*[\d,]+k?/g, "")
    .replace(/below\s*[\d,]+k?/g, "")
    .replace(/between\s*[\d,]+k?\s*(and|to|-)\s*[\d,]+k?/g, "")
    .replace(/for me|please/g, "")
    .trim();

  // if still too generic, fall back to original
  if (!product || product.length < 3) {
    product = raw;
  }

  return {
    raw,
    productKeywords: product,
    maxPrice,
    minPrice,
  };
}
