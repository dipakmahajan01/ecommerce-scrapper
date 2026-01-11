import { Request, Response } from "express";
import { getDeviceList } from "../service/getDeviceData";
import {
  getProductDetails,
  scoreAndRankProductList,
} from "../service/productRelevanceEngine";
import { generateCategoryWeights } from "../service/ai/weightGenerator";
import { parseUserQueryWithAI } from "../helpers/aiParser";
import { buildFlipkartSearchUrl } from "../helpers/flipkart";
import { scrapeFlipkartSearch } from "../service/scrapper";
import {
  SmartPrixRecord,
  ProductTrackingEntry,
  TrackingData,
} from "src/service/productRelevanceEngine/types";

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

  const trackingMap = new Map<string, ProductTrackingEntry>();

  try {
    const parsed = await parseUserQueryWithAI(userQuery);
    const flipkartUrl = buildFlipkartSearchUrl(parsed);
    const products = await scrapeFlipkartSearch(flipkartUrl);

    for (const product of products) {
      if (product.title) {
        trackingMap.set(product.title, {
          details: {
            title: product.title,
            price: product.price,
            description: product.description,
            link: product.link,
            image: product.image,
            rating: product.rating,
          },
        });
      }
    }

    const weightResult = await generateCategoryWeights(userQuery.trim());

    if (!weightResult.success) {
      const tracking: TrackingData = {
        query: {
          raw: userQuery,
          parsed: {
            query: parsed.query,
            maxPrice: parsed.maxPrice ?? null,
            minPrice: parsed.minPrice ?? null,
            brands: parsed.brands ?? null,
            storage: parsed.storage ?? null,
            ram: parsed.ram ?? null,
          },
        },
        products: Object.fromEntries(trackingMap),
      };

      return res.json({
        success: false,
        requiresClarification: true,
        query: userQuery,
        questions: weightResult.clarifyingQuestions.questions,
        tracking,
      });
    }

    const allProducts = await getProductDetails(products, trackingMap);

    if (!allProducts || allProducts.length === 0) {
      const tracking: TrackingData = {
        query: {
          raw: userQuery,
          parsed: {
            query: parsed.query,
            maxPrice: parsed.maxPrice ?? null,
            minPrice: parsed.minPrice ?? null,
            brands: parsed.brands ?? null,
            storage: parsed.storage ?? null,
            ram: parsed.ram ?? null,
          },
        },
        products: Object.fromEntries(trackingMap),
      };

      return res.status(500).json({
        success: false,
        error: "No products available in the database",
        tracking,
      });
    }

    const topProducts = scoreAndRankProductList(
      allProducts,
      weightResult.weights,
      20,
      trackingMap
    );

    const tracking: TrackingData = {
      query: {
        raw: userQuery,
        parsed: {
          query: parsed.query,
          maxPrice: parsed.maxPrice ?? null,
          minPrice: parsed.minPrice ?? null,
          brands: parsed.brands ?? null,
          storage: parsed.storage ?? null,
          ram: parsed.ram ?? null,
        },
      },
      products: Object.fromEntries(trackingMap),
    };

    return res.json({
      success: true,
      query: userQuery,
      weights: weightResult.weights,
      products: topProducts,
      count: topProducts.length,
      tracking,
    });
  } catch (error: any) {
    console.error("[ProductRecommendation] Error:", error);
    const tracking: TrackingData = {
      query: {
        raw: userQuery,
        parsed: {
          query: "",
          maxPrice: null,
          minPrice: null,
          brands: null,
          storage: null,
          ram: null,
        },
      },
      products: Object.fromEntries(trackingMap),
    };

    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate product recommendations",
      tracking,
    });
  }
};
