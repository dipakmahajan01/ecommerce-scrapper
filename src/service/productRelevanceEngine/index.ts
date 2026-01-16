import { getDeviceList } from "../getDeviceData";
import {
  ExtractedSpecs,
  FullSpecsResult,
  Score,
  SmartPrixRecord,
  StatKey,
  CategoryWeights,
  ProductCategoryScores,
  ProductTrackingEntry,
  TrackingStep,
  ScrapedProduct,
  EnrichedProduct,
  ScoredProduct,
} from "./types";
import { scoreAndRankProducts } from "./scoringEngine";

export const getProductDetails = async (
  productList: ScrapedProduct[],
  trackingMap?: Map<string, ProductTrackingEntry>
) => {
  const docs = getDeviceList();
  const dbProducts = Array.isArray(docs) ? docs : [];

  const dbProdTokenCache = dbProducts.map((dbProd) => ({
    dbProd,
    tokens: dbProd.title.toLowerCase().split(/\s+/).filter(Boolean),
  }));

  const enrichedList = productList.map((product) => {
    let bestMatch: SmartPrixRecord | null = null;
    let bestScore = 0.0;

    const cleanedTitle = product.title.replace(/\s*\([^)]*\)/g, "");
    const productTokens = cleanedTitle
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
        bestScore = score;
        bestMatch = dbProd;
      }
    }

    if (trackingMap) {
      const trackingEntry = trackingMap.get(product.title);
      if (trackingEntry) {
        const dbMatchStep: TrackingStep = {
          name: "dbMatch",
          details: {
            matched: bestScore > 0.4 && bestMatch !== null,
            score: bestScore,
            dbProduct: bestMatch || null,
            reason:
              bestScore > 0.4 && bestMatch
                ? undefined
                : bestScore <= 0.4
                ? `Match score ${bestScore} below threshold 0.4`
                : "No matching product found in database",
          },
        };
        trackingEntry.nextStep = dbMatchStep;
      }
    }

    return bestScore > 0.4 && bestMatch
      ? {
          ...bestMatch,
          realTitle: product.title,
          flipkartLink: product.link || null,
          flipkartImage: product.image || null,
          dbRecordId: bestMatch._id,
        }
      : null;
  });

  return enrichedList.filter((x): x is EnrichedProduct => x !== null);
};

export const scoreAndRankProductList = (
  productList: EnrichedProduct[],
  weights: CategoryWeights,
  topN: number = 20,
  trackingMap?: Map<string, ProductTrackingEntry>
) => {
  return scoreAndRankProducts(productList, weights, topN, trackingMap);
};
