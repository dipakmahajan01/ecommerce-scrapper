import {
  SmartPrixRecord,
  CategoryWeights,
  ProductCategoryScores,
  CategoryProcessor,
  NormalizationContext,
  ProductTrackingEntry,
  TrackingStep,
  EnrichedProduct,
  ScoredProduct,
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
 * Traverses the tracking entry chain to find the last step
 */
function getLastStep(trackingEntry: ProductTrackingEntry): TrackingStep | null {
  if (!trackingEntry.nextStep) {
    return null;
  }
  let current: TrackingStep | undefined = trackingEntry.nextStep;
  while (current?.nextStep) {
    current = current.nextStep;
  }
  return current || null;
}

/**
 * Stage 1: Validation Pipeline
 * Filters products to keep only those that pass validation from ALL processors
 */
function validateProducts(
  products: EnrichedProduct[],
  trackingMap?: Map<string, ProductTrackingEntry>
) {
  if (products.length === 0) {
    return [];
  }

  const processors = getCategoryProcessors();
  const validProducts = products.filter((product) => {
    // Product must pass validation from ALL processors
    const isValid = processors.every((processor) =>
      processor.validateProduct(product)
    );

    if (trackingMap) {
      const productTitle = product.realTitle || product.title;
      const trackingEntry = trackingMap.get(productTitle);
      if (trackingEntry) {
        const lastStep = getLastStep(trackingEntry);
        if (lastStep) {
          const failedProcessors = processors
            .filter((processor) => !processor.validateProduct(product))
            .map((processor) => processor.getCategoryName());

          const validationStep: TrackingStep = {
            name: "validation",
            details: {
              valid: isValid,
              failedProcessors:
                failedProcessors.length > 0 ? failedProcessors : [],
            },
          };
          lastStep.nextStep = validationStep;
        }
      }
    }

    return isValid;
  });

  return validProducts;
}

/**
 * Build complete normalization context from all products
 */
function buildNormalizationContext(
  allProducts: EnrichedProduct[]
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
    ramCapacity: context.ramCapacity || { min: 0, max: 1 },
    romCapacity: context.romCapacity || { min: 0, max: 1 },
  };
}

/**
 * Score a single product across all categories
 */
export function scoreProduct(
  product: EnrichedProduct,
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
  const ramProcessor = processorMap.get("ramCapacity")!;
  const romProcessor = processorMap.get("romCapacity")!;

  const batteryRaw = batteryProcessor.process(product, context);
  // const softwareRaw = softwareProcessor.process(product, context);
  const displayRaw = displayProcessor.process(product, context);
  const cpuRaw = cpuProcessor.process(product, context);
  const gpuRaw = gpuProcessor.process(product, context);
  const cameraRaw = cameraProcessor.process(product, context);
  const ramRaw = ramProcessor.process(product, context);
  const romRaw = romProcessor.process(product, context);

  // Get weights (use as-is, formula: Score = Σ(w_i * n_i))
  const batteryWeight = weights.batteryEndurance;
  // const softwareWeight = weights.softwareExperience;
  const displayWeight = weights.displayQuality;
  const cpuWeight = weights.cpuPerformance;
  const gpuWeight = weights.gpuPerformance;
  const cameraWeight = weights.cameraQuality;
  const ramWeight = weights.ramCapacity;
  const romWeight = weights.romCapacity;

  // Calculate weighted scores
  const batteryWeighted = batteryRaw * batteryWeight;
  // const softwareWeighted = softwareRaw * softwareWeight;
  const displayWeighted = displayRaw * displayWeight;
  const cpuWeighted = cpuRaw * cpuWeight;
  const gpuWeighted = gpuRaw * gpuWeight;
  const cameraWeighted = cameraRaw * cameraWeight;
  const ramWeighted = ramRaw * ramWeight;
  const romWeighted = romRaw * romWeight;

  // Total weighted score: Σ(w_i * n_i)
  const totalWeightedScore =
    batteryWeighted +
    // softwareWeighted +
    displayWeighted +
    cpuWeighted +
    gpuWeighted +
    cameraWeighted +
    ramWeighted +
    romWeighted;

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
    ramCapacity: {
      category: "ramCapacity",
      rawScore: ramRaw,
      weightedScore: ramWeighted,
    },
    romCapacity: {
      category: "romCapacity",
      rawScore: romRaw,
      weightedScore: romWeighted,
    },
    totalWeightedScore,
  };
}

/**
 * Score all products and return top N products sorted by total weighted score
 * Pipeline: Validation → Context Building → Scoring
 */
export function scoreAndRankProducts(
  products: EnrichedProduct[],
  weights: CategoryWeights,
  topN: number = 20,
  trackingMap?: Map<string, ProductTrackingEntry>
) {
  if (products.length === 0) {
    return [];
  }

  // Stage 1: Validation Pipeline
  const validProducts = validateProducts(products, trackingMap);
  console.log("VALID PRODUCTS", products.length, "==", validProducts.length);

  if (validProducts.length === 0) {
    return [];
  }

  // Stage 2: Context Building
  const context = buildNormalizationContext(validProducts);

  // Stage 3: Scoring Pipeline
  const scoredProducts = validProducts.map((product) => {
    const categoryScores = scoreProduct(product, context, weights);

    if (trackingMap) {
      const productTitle = product.realTitle || product.title;
      const trackingEntry = trackingMap.get(productTitle);
      if (trackingEntry) {
        const lastStep = getLastStep(trackingEntry);
        if (lastStep && "name" in lastStep) {
          const scoringStep: TrackingStep = {
            name: "scoring",
            details: {
              totalWeightedScore: categoryScores.totalWeightedScore,
              categoryScores: {
                batteryEndurance: categoryScores.batteryEndurance,
                displayQuality: categoryScores.displayQuality,
                cpuPerformance: categoryScores.cpuPerformance,
                gpuPerformance: categoryScores.gpuPerformance,
                cameraQuality: categoryScores.cameraQuality,
                ramCapacity: categoryScores.ramCapacity,
                romCapacity: categoryScores.romCapacity,
              },
            },
          };
          lastStep.nextStep = scoringStep;
        }
      }
    }

    return {
      ...product,
      categoryScores,
    };
  });

  // Sort by total weighted score (descending)
  scoredProducts.sort(
    (a, b) =>
      b.categoryScores.totalWeightedScore - a.categoryScores.totalWeightedScore
  );

  // Return top N
  return scoredProducts.slice(0, topN).map((product) => {
    return {
      link: product.link,
      title: product.title,
      brand: product.brand,
      extracted: product.normalizedSpecs?.extracted,
      flipkartLink: product.flipkartLink,
      flipkartImage: product.flipkartImage,
      dbRecordId: product.dbRecordId,
      ...product.categoryScores,
    };
  });
}
