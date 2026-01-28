import { Request, Response } from "express";
import { getDeviceList } from "../service/getDeviceData";
import { scoreAndRankProductList } from "../service/productRelevanceEngine";
import { generateCategoryWeights } from "../service/ai/weightGenerator";
import { generateProductVerdict } from "../service/ai/productVerdict";
import { parseUserQueryWithAI } from "../helpers/aiParser";
import {
  ProductTrackingEntry,
  TrackingData,
} from "src/service/productRelevanceEngine/types";
import { UserQueryModel, IConversationMessage } from "../models/userQuery";
import { applyProductFilters } from "../service/productRelevanceEngine/filters";

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
    const parsedResult = await parseUserQueryWithAI(userQuery);

    if (!parsedResult.success) {
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

      return res.json({
        success: false,
        requiresClarification: true,
        query: userQuery,
        questions: parsedResult.questions,
        tracking,
      });
    }

    const parsed = parsedResult.parsed;

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

    const allDevices = getDeviceList() ?? [];

    const filteredDevices = applyProductFilters(allDevices, {
      parsed,
      budgetInfo: parsed.budgetInfo,
    });

    for (const device of filteredDevices) {
      if (!trackingMap.has(device.title)) {
        trackingMap.set(device.title, {
          details: {
            title: device.title,
            price: device.price,
            link: device.link,
            brand: device.brand,
            budgetInfo: parsed.budgetInfo,
          },
        });
      }
    }

    const allProducts = filteredDevices.map((device) => ({
      ...device,
      realTitle: device.title,
      images: device.images || [],
      dbRecordId: device._id,
    }));

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
      8,
      trackingMap
    );

    const initialUserMessage: IConversationMessage = {
      type: "text",
      role: "user",
      content: userQuery,
      timestamp: new Date(),
    };

    const productViewMessages: IConversationMessage[] = await Promise.all(
      topProducts.map(async (product) => {
        const verdict = await generateProductVerdict({
          weights: weightResult.weights,
          userQuery,
          product,
        });

        return {
          type: "product-view" as const,
          role: "assistant" as const,
          product: {
            images: product.images,
            specs: product.specs,
            title: product.title,
            price: product.price,
          },
          verdict: "NOT AVAILABLE",
          afLink: {
            amazon: "",
          },
          timestamp: new Date(),
        };
      })
    );

    const messages: IConversationMessage[] = [
      initialUserMessage,
      ...productViewMessages,
    ];

    let savedId: string | null = null;
    try {
      const savedQuery = await UserQueryModel.create({
        query: userQuery,
        products: topProducts,
        messages,
      });
      savedId = savedQuery._id.toString();
    } catch (saveError) {
      console.error(
        "[ProductRecommendation] Error saving to database:",
        saveError
      );
    }

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
      id: savedId,
      query: userQuery,
      weights: weightResult.weights,
      budgetInfo: parsed.budgetInfo,
      products: topProducts,
      format: topProducts.map((item) => ({
        title: item.title,
        link: item.link,
        score: item.totalWeightedScore,
      })),
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
