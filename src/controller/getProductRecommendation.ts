import { Request, Response } from "express";
import { UserQueryModel } from "../models/userQuery";
import { ProductRecommendationResponse } from "../service/productRelevanceEngine/types";

export const getProductRecommendation = async (req: Request, res: Response) => {
  const threadId = (req.query.threadId as string) || req.params.id;

  if (!threadId || threadId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing 'threadId' parameter in request query or path.",
    });
  }

  try {
    const userQuery = await UserQueryModel.findOne({ threadId }).lean();

    // if (!userQuery) {
    //   return res.status(404).json({
    //     success: false,
    //     error: `No recommendation found with threadId: ${threadId}`,
    //   });
    // }

    const response: ProductRecommendationResponse = {
      // id: userQuery._id.toString(),
      threadId: userQuery?.threadId || threadId,
      // products: userQuery.products as ProductRecommendationResponse["products"],
      // userQuery: userQuery.query,
      messages: userQuery?.messages ?? []
    };

    return res.json(response);
  } catch (error: unknown) {
    console.error("[GetProductRecommendation] Error:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to retrieve product recommendation",
    });
  }
};
