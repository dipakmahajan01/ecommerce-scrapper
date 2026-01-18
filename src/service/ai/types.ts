import { CategoryWeights } from "../productRelevanceEngine/types";

export type BudgetInfo = {
  budget: number;
  extensionAmount: number | null;
};

export type ClarifyingQuestions = {
  requiresClarification: true;
  questions: string[];
};

export type WeightGenerationResult =
  | { success: true; weights: CategoryWeights }
  | { success: false; clarifyingQuestions: ClarifyingQuestions };

