import { SmartPrixRecord } from "./types";
import { ParsedQuery } from "../../helpers/aiParser";
import { BudgetInfo } from "../ai/types";
import {
  filterByPrice,
  PriceFilterOptions,
} from "./priceFilter";

export interface FilterOptions {
  parsed: ParsedQuery;
  budgetInfo: BudgetInfo | undefined;
}

export function applyProductFilters(
  devices: SmartPrixRecord[],
  options: FilterOptions
): SmartPrixRecord[] {
  const { parsed, budgetInfo } = options;

  return devices.filter((device) => {
    const priceOptions: PriceFilterOptions = {
      minPrice: parsed.minPrice,
      maxPrice: parsed.maxPrice,
      budgetInfo,
    };

    const priceResult = filterByPrice(device.price, priceOptions);
    return priceResult.passed;
  });
}
