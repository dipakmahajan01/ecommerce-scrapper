import { Request, Response } from "express";
import { getDeviceList } from "../service/getDeviceData";
import { scoreAndRankProductList } from "../service/productRelevanceEngine";
import { generateCategoryWeights } from "../service/ai/weightGenerator";

export const getProductRecommendations = async (
  req: Request,
  res: Response
) => {
  const userQuery = (req.body?.query as string) || "";

  if (!userQuery || userQuery.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error:
        "Missing 'query' parameter in request body. Please provide a search query.",
    });
  }

  try {
    const weightResult = await generateCategoryWeights(userQuery.trim());

    if (!weightResult.success) {
      return res.json({
        success: false,
        requiresClarification: true,
        query: userQuery,
        questions: weightResult.clarifyingQuestions.questions,
      });
    }

    const allProducts = getDeviceList();

    if (!allProducts || allProducts.length === 0) {
      return res.status(500).json({
        success: false,
        error: "No products available in the database",
      });
    }

    const topProducts = scoreAndRankProductList(
      allProducts,
      weightResult.weights,
      20
    );

    return res.json({
      success: true,
      query: userQuery,
      weights: weightResult.weights,
      products: topProducts,
      count: topProducts.length,
    });
  } catch (error: any) {
    console.error("[ProductRecommendation] Error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate product recommendations",
    });
  }
};
