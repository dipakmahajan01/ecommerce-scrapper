import { tool } from "ai";
import { z } from "zod";
import { getDeviceList } from "../getDeviceData";
import { scoreAndRankProductList } from "../productRelevanceEngine";
import { generateCategoryWeights } from "../ai/weightGenerator";
import { generateProductVerdict } from "../ai/productVerdict";
import { parseUserQueryWithAI } from "../../helpers/aiParser";
import { applyProductFilters } from "../productRelevanceEngine/filters";
import { ScoredProduct } from "../productRelevanceEngine/types";
import { LocalState } from "./localState";

export interface ProductRecommendationToolResult {
  recommendations?: Array<{ title: string; verdict: string }>;
  clarificationQuestions?: string[];
}

export interface ProductRecommendationToolData {
  parsedQuery: ReturnType<typeof parseUserQueryWithAI> extends Promise<infer T>
  ? T extends { success: true; parsed: infer P }
  ? P
  : never
  : never;
  weights: ReturnType<
    typeof generateCategoryWeights
  > extends Promise<infer T>
  ? T extends { success: true; weights: infer W }
  ? W
  : never
  : never;
  products: ScoredProduct[];
}

export function createProductRecommendationTool(localState: LocalState) {
  return tool({
    description:
      "Generate product recommendations based on user query. Use this tool when users ask for product recommendations, suggestions, or want to find products with specific criteria.",
    inputSchema: z.object({
      userQuery: z.string().describe("The user's query for product recommendations"),
    }),
    execute: async ({ userQuery }): Promise<ProductRecommendationToolResult> => {
      try {
        const parsedResult = await parseUserQueryWithAI(userQuery);

        if (!parsedResult.success) {
          localState.set("parsedQuery", null);
          return {
            clarificationQuestions: parsedResult.questions,
          };
        }

        const parsed = parsedResult.parsed;
        localState.set("parsedQuery", parsed);

        const weightResult = await generateCategoryWeights(userQuery.trim());

        if (!weightResult.success) {
          localState.set("weights", null);
          return {
            clarificationQuestions: weightResult.clarifyingQuestions.questions,
          };
        }

        const weights = weightResult.weights;
        localState.set("weights", weights);

        const allDevices = getDeviceList() ?? [];

        const filteredDevices = applyProductFilters(allDevices, {
          parsed,
          budgetInfo: parsed.budgetInfo,
        });

        const allProducts = filteredDevices.map((device) => ({
          ...device,
          realTitle: device.title,
          images: device.images || [],
          dbRecordId: device._id,
        }));

        if (!allProducts || allProducts.length === 0) {
          return {
            clarificationQuestions: [
              "No products found matching your criteria. Could you provide more details about what you're looking for?",
            ],
          };
        }

        const topProducts = scoreAndRankProductList(allProducts, weights, 8);

        const recommendationsWithVerdicts = await Promise.all(
          topProducts.map(async (product) => {
            const verdict = await generateProductVerdict({
              weights,
              userQuery,
              product,
            });

            return {
              ...product,
              verdict,
            };
          })
        );

        localState.set("recommendations", recommendationsWithVerdicts.map((r) => ({
          title: r.title,
          verdict: r.verdict,
        })));

        localState.set("products", recommendationsWithVerdicts);

        return {
          recommendations: recommendationsWithVerdicts,
        };
      } catch (error) {
        console.error("[ProductRecommendationTool] Error:", error);
        return {
          clarificationQuestions: [
            "I encountered an error while searching for products. Could you please rephrase your query?",
          ],
        };
      }
    },
  });
}
