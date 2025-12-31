import { getDeviceList } from "../getDeviceData";
import {
  ExtractedSpecs,
  FullSpecsResult,
  Score,
  SmartPrixRecord,
  StatKey,
} from "./types";
import {
  getHighestAndLowestValues,
  getNestedValue,
  minMaxNormalize,
  tokenSimilarity,
} from "./utils";

export const getProductDetails = async (productList: { name: string }[]) => {
  const docs = getDeviceList();
  const dbProducts = Array.isArray(docs) ? docs : [];

  const dbProdTokenCache = dbProducts.map((dbProd) => ({
    dbProd,
    tokens: dbProd.title.toLowerCase().split(/\s+/).filter(Boolean),
  }));

  const enrichedList = productList.map((product) => {
    let bestMatch: any = null;
    let bestScore = 0.0;

    const productTokens = product.name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    for (const { dbProd, tokens: dbProdTokens } of dbProdTokenCache) {
      // Compute intersection/union directly for token similarity, avoid reconstructing sets for each dbProd
      const productTokenSet = new Set(productTokens);

      const intersectionSize = dbProdTokens.filter((token) =>
        productTokenSet.has(token)
      ).length;
      const unionSet = new Set([...productTokens, ...dbProdTokens]);
      const unionSize = unionSet.size || 1;

      const score = intersectionSize / unionSize;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          title: dbProd.title,
          link: dbProd.link,
          realTitle: product.name,
          parseSpecs: dbProd.parseHtmlSpec,
        };
      }
    }

    return bestScore > 0.4
      ? {
          ...bestMatch,
          realTitle: product.name,
        }
      : null;
  });

  return enrichedList;
};

export const sortProductList = async (productList: SmartPrixRecord[]) => {
  const highestAndLowestValues = getHighestAndLowestValues(productList);
  // For each product, calculate normalized scores for each stat, and add a total as 'score.total'
  const normalizeRatedProducts = productList.map((product) => {
    const productClone = structuredClone({
      ...product,
      score: {} as Score,
    });

    const scores: Score = {};
    const fields: [string, StatKey][] = [
      ["display.resolution.value", "displayResolution"],
      ["display.type.score", "displayType"], // 'type' may be optional / not always present
      ["display.brightness.value", "brightness"],
      ["display.refreshRate.value", "refreshRate"],
      ["display.ppi.value", "ppi"],
      ["battery.capacity.value", "capacity"],
      ["camera.rearCamera[0].megapixel", "rearMp"],
      ["camera.frontCamera[0].megapixel", "frontMp"],
    ];

    for (const [path, statKey] of fields) {
      let value: number | null | undefined = null;

      try {
        value = getNestedValue(productClone.normalizedSpecs.extracted, path);
      } catch {
        value = null;
      }

      const min =
        highestAndLowestValues[statKey as keyof typeof highestAndLowestValues]
          ?.low;
      const max =
        highestAndLowestValues[statKey as keyof typeof highestAndLowestValues]
          ?.high;

      // Only calculate score if value/min/max all exist and min != max (avoid div by zero)
      if (
        typeof value === "number" &&
        typeof min === "number" &&
        typeof max === "number" &&
        max > min
      ) {
        scores[statKey] = minMaxNormalize(value, min, max);
      } else {
        scores[statKey] = null;
      }
    }

    // Calculate the total of every score (ignoring nulls)
    const scoreValues = Object.values(scores).filter(
      (item) => typeof item === "number"
    );
    const totalScore = scoreValues.reduce((sum, v) => sum + (v ?? 0), 0);

    scores.total = totalScore;
    productClone.score = scores;
    return productClone;
  });

  const topProducts = normalizeRatedProducts.sort(
    (a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0)
  );

  return topProducts.slice(0, 20);
};
