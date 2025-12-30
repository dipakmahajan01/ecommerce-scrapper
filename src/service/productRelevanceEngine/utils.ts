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
