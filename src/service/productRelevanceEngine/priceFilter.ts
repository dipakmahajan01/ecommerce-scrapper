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
  const {
    maxPrice = 0,
    minPrice = 0,
    budgetInfo
  } = options ?? {};

  if (minPrice !== null && devicePrice < minPrice) {
    return {
      passed: false,
      reason: `Price ${devicePrice} is below minimum ${options.minPrice}`,
    };
  }

  if (!maxPrice) {
    return {
      passed: false,
      reason: `Provide the max price`,
    };
  }

  let effectiveMaxPrice: number = maxPrice;

  if (budgetInfo) {
    const { budget, extensionAmount } = budgetInfo;
    effectiveMaxPrice = calculateEffectiveMaxPrice(budget, extensionAmount);
  }

  const maxPriceLimit = Math.max(maxPrice, effectiveMaxPrice);

  if (devicePrice > maxPriceLimit) {
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
