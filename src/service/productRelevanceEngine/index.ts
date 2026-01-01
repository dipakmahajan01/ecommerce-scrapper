import { getDeviceList } from "../getDeviceData";
import {
  ExtractedSpecs,
  FullSpecsResult,
  Score,
  SmartPrixRecord,
  StatKey,
  CategoryWeights,
  ProductCategoryScores,
} from "./types";
import { scoreAndRankProducts } from "./scoringEngine";

export const getProductDetails = async (productList: { name: string }[]) => {
  const docs = getDeviceList();
  const dbProducts = Array.isArray(docs) ? docs : [];

  const dbProdTokenCache = dbProducts.map((dbProd) => ({
    dbProd,
    tokens: dbProd.title.toLowerCase().split(/\s+/).filter(Boolean),
  }));

  const enrichedList = productList.map((product) => {
    let bestMatch: SmartPrixRecord | null = null;
    let bestScore = 0.0;

    const productTokens = product.name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    for (const { dbProd, tokens: dbProdTokens } of dbProdTokenCache) {
      const productTokenSet = new Set(productTokens);

      const intersectionSize = dbProdTokens.filter((token) =>
        productTokenSet.has(token)
      ).length;
      const unionSet = new Set([...productTokens, ...dbProdTokens]);
      const unionSize = unionSet.size || 1;

      const score = intersectionSize / unionSize;

      if (score > bestScore) {
        // Ensure dbProd has FullSpecsResult shape, then add realTitle separately for return type
        bestScore = score;
        bestMatch = dbProd;
      }
    }

    return bestScore > 0.4 && bestMatch
      ? { ...bestMatch, realTitle: product.name }
      : null;
  });

  return enrichedList;
};

export const scoreAndRankProductList = (
  productList: SmartPrixRecord[],
  weights: CategoryWeights,
  topN: number = 20
): Array<SmartPrixRecord & { categoryScores: ProductCategoryScores }> => {
  return scoreAndRankProducts(productList, weights, topN);
};
