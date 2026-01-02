import {
  SmartPrixRecord,
  CategoryWeights,
  ProductCategoryScores,
  CategoryProcessor,
  NormalizationContext,
} from "./types";
import { getCategoryProcessors } from "./categoryProcessors";

/**
 * Maps category names to processor instances
 */
function getProcessorMap(): Map<string, CategoryProcessor> {
  const processors = getCategoryProcessors();
  const map = new Map<string, CategoryProcessor>();
  processors.forEach((processor) => {
    map.set(processor.getCategoryName(), processor);
  });
  return map;
}

/**
 * Stage 1: Validation Pipeline
 * Filters products to keep only those that pass validation from ALL processors
 */
function validateProducts(products: SmartPrixRecord[]): SmartPrixRecord[] {
  if (products.length === 0) {
    return [];
  }

  const processors = getCategoryProcessors();
  const validProducts = products.filter((product) => {
    // Product must pass validation from ALL processors
    return processors.every((processor) => processor.validateProduct(product));
  });

  return validProducts;
}

/**
 * Build complete normalization context from all products
 */
function buildNormalizationContext(
  allProducts: SmartPrixRecord[]
): NormalizationContext {
  const processors = getCategoryProcessors();
  const context: Partial<NormalizationContext> = {};

  // Collect all context parts from each processor
  processors.forEach((processor) => {
    const partialContext = processor.prepareContext(allProducts);
    Object.assign(context, partialContext);
  });

  // Ensure all required fields have defaults
  return {
    batteryCapacity: context.batteryCapacity || { min: 0, max: 1 },
    // softwareScore: context.softwareScore || { min: 0, max: 1 },
    displayType: context.displayType || { min: 0, max: 10 },
    displayPpi: context.displayPpi || { min: 0, max: 1 },
    displayRefreshRate: context.displayRefreshRate || { min: 0, max: 1 },
    displayBrightness: context.displayBrightness || { min: 0, max: 1 },
    // displayHdr: context.displayHdr || { min: 0, max: 10 },
    cpuScore: context.cpuScore || { min: 0, max: 1 },
    gpuScore: context.gpuScore || { min: 0, max: 1 },
    cameraMainMp: context.cameraMainMp || { min: 0, max: 1 },
    // cameraCount: context.cameraCount || { min: 1, max: 1 },
  };
}

/**
 * Score a single product across all categories
 */
export function scoreProduct(
  product: SmartPrixRecord,
  context: NormalizationContext,
  weights: CategoryWeights
): ProductCategoryScores {
  const processorMap = getProcessorMap();

  // Calculate raw scores for each category
  const batteryProcessor = processorMap.get("batteryEndurance")!;
  // const softwareProcessor = processorMap.get("softwareExperience")!;
  const displayProcessor = processorMap.get("displayQuality")!;
  const cpuProcessor = processorMap.get("cpuPerformance")!;
  const gpuProcessor = processorMap.get("gpuPerformance")!;
  const cameraProcessor = processorMap.get("cameraQuality")!;

  const batteryRaw = batteryProcessor.process(product, context);
  // const softwareRaw = softwareProcessor.process(product, context);
  const displayRaw = displayProcessor.process(product, context);
  const cpuRaw = cpuProcessor.process(product, context);
  const gpuRaw = gpuProcessor.process(product, context);
  const cameraRaw = cameraProcessor.process(product, context);

  // Get weights (use as-is, formula: Score = Σ(w_i * n_i))
  const batteryWeight = weights.batteryEndurance;
  // const softwareWeight = weights.softwareExperience;
  const displayWeight = weights.displayQuality;
  const cpuWeight = weights.cpuPerformance;
  const gpuWeight = weights.gpuPerformance;
  const cameraWeight = weights.cameraQuality;

  // Calculate weighted scores
  const batteryWeighted = batteryRaw * batteryWeight;
  // const softwareWeighted = softwareRaw * softwareWeight;
  const displayWeighted = displayRaw * displayWeight;
  const cpuWeighted = cpuRaw * cpuWeight;
  const gpuWeighted = gpuRaw * gpuWeight;
  const cameraWeighted = cameraRaw * cameraWeight;

  // Total weighted score: Σ(w_i * n_i)
  const totalWeightedScore =
    batteryWeighted +
    // softwareWeighted +
    displayWeighted +
    cpuWeighted +
    gpuWeighted +
    cameraWeighted;

  return {
    batteryEndurance: {
      category: "batteryEndurance",
      rawScore: batteryRaw,
      weightedScore: batteryWeighted,
    },
    // softwareExperience: {
    //   category: "softwareExperience",
    //   rawScore: softwareRaw,
    //   weightedScore: softwareWeighted,
    // },
    displayQuality: {
      category: "displayQuality",
      rawScore: displayRaw,
      weightedScore: displayWeighted,
    },
    cpuPerformance: {
      category: "cpuPerformance",
      rawScore: cpuRaw,
      weightedScore: cpuWeighted,
    },
    gpuPerformance: {
      category: "gpuPerformance",
      rawScore: gpuRaw,
      weightedScore: gpuWeighted,
    },
    cameraQuality: {
      category: "cameraQuality",
      rawScore: cameraRaw,
      weightedScore: cameraWeighted,
    },
    totalWeightedScore,
  };
}

/**
 * Score all products and return top N products sorted by total weighted score
 * Pipeline: Validation → Context Building → Scoring
 */
export function scoreAndRankProducts(
  products: SmartPrixRecord[],
  weights: CategoryWeights,
  topN: number = 20
) {
  if (products.length === 0) {
    return [];
  }

  // Stage 1: Validation Pipeline
  const validProducts = validateProducts(products);
  console.log("VALID PRODUCTS", products.length, "==", validProducts.length);

  if (validProducts.length === 0) {
    return [];
  }

  // Stage 2: Context Building
  const context = buildNormalizationContext(validProducts);

  // Stage 3: Scoring Pipeline
  const scoredProducts = validProducts.map((product) => ({
    ...product,
    categoryScores: scoreProduct(product, context, weights),
  }));

  // Sort by total weighted score (descending)
  scoredProducts.sort(
    (a, b) =>
      b.categoryScores.totalWeightedScore - a.categoryScores.totalWeightedScore
  );

  // Return top N
  return scoredProducts.slice(0, topN).map((product) => ({
    link: product.link,
    title: product.title,
    brand: product.brand,
    extracted: product.normalizedSpecs?.extracted,
    ...product.categoryScores,
  }));
}
