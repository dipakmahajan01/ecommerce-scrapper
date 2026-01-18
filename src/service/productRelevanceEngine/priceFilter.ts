import { BudgetInfo } from "../ai/types";

export interface PriceFilterOptions {
  minPrice: number | null;
  maxPrice: number | null;
  budgetInfo: BudgetInfo | undefined;
}

export interface PriceFilterResult {
  passed: boolean;
  reason?: string;
  effectiveMaxPrice?: number;
}

export function calculateEffectiveMaxPrice(
  budget: number,
  extensionAmount: number | null
): number {
  if (extensionAmount === null) {
    return budget >= 20000 ? budget + 1000 : budget + 500;
  }
  return budget + extensionAmount;
}

export function filterByPrice(
  devicePrice: number,
  options: PriceFilterOptions
): PriceFilterResult {
  if (options.minPrice !== null && devicePrice < options.minPrice) {
    return {
      passed: false,
      reason: `Price ${devicePrice} is below minimum ${options.minPrice}`,
    };
  }

  let effectiveMaxPrice: number | undefined;

  if (options.budgetInfo) {
    const { budget, extensionAmount } = options.budgetInfo;
    effectiveMaxPrice = calculateEffectiveMaxPrice(budget, extensionAmount);
  }

  const maxPriceLimit =
    options.maxPrice !== null && effectiveMaxPrice !== undefined
      ? Math.min(options.maxPrice, effectiveMaxPrice)
      : options.maxPrice !== null
        ? options.maxPrice
        : effectiveMaxPrice;

  if (maxPriceLimit !== undefined && devicePrice > maxPriceLimit) {
    return {
      passed: false,
      reason: `Price ${devicePrice} exceeds maximum limit ${maxPriceLimit}`,
      effectiveMaxPrice: maxPriceLimit,
    };
  }

  return {
    passed: true,
    effectiveMaxPrice: maxPriceLimit,
  };
}
