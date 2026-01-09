import { Request, Response } from "express";
import { getDeviceList } from "../service/getDeviceData";
import {
  getProductDetails,
  scoreAndRankProductList,
} from "../service/productRelevanceEngine";
import { generateCategoryWeights } from "../service/ai/weightGenerator";
import { parseUserQueryWithAI } from "../helpers/aiParser";
import { parseUserQuery } from "../helpers/nlp";
import { buildFlipkartSearchUrl } from "../helpers/flipkart";
import { scrapeFlipkartSearch } from "../service/scrapper";
import { SmartPrixRecord } from "src/service/productRelevanceEngine/types";

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
    let parsed;
    try {
      parsed = await parseUserQueryWithAI(userQuery);
    } catch (aiErr: any) {
      console.error(
        "[product] AI parse failed, falling back to local NLP parser:",
        aiErr?.message || aiErr
      );
      parsed = parseUserQuery(userQuery);
    }

    const flipkartUrl = buildFlipkartSearchUrl({
      raw: userQuery,
      productKeywords: parsed.productKeywords,
      maxPrice: parsed.maxPrice ?? undefined,
      minPrice: parsed.minPrice ?? undefined,
    });
    const products = await scrapeFlipkartSearch(flipkartUrl);

    const weightResult = await generateCategoryWeights(userQuery.trim());

    if (!weightResult.success) {
      return res.json({
        success: false,
        requiresClarification: true,
        query: userQuery,
        questions: weightResult.clarifyingQuestions.questions,
      });
    }

    const allProducts = await getProductDetails(products as any);

    if (!allProducts || allProducts.length === 0) {
      return res.status(500).json({
        success: false,
        error: "No products available in the database",
      });
    }

    const topProducts = scoreAndRankProductList(
      allProducts as unknown as SmartPrixRecord[],
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
