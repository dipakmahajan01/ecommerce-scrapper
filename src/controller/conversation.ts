import { Request, Response } from "express";
import { UserQueryModel } from "../models/userQuery";
import { IConversationMessage as ConversationMessage } from "../models/userQuery";
import { runAgent } from "../service/agent";
import { LocalState } from "../service/agent/localState";
import { ScoredProduct } from "../service/productRelevanceEngine/types";

const MAX_MESSAGE_LIMIT = 50;
const MESSAGES_TO_LOAD = 12;

export const handleConversation = async (req: Request, res: Response) => {
  const threadId = (req.body?.threadId as string) || req.params.id;
  const userMessage = (req.body?.message as string) || "";

  if (!threadId || threadId.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing 'threadId' parameter in request body or path.",
    });
  }

  if (!userMessage || userMessage.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing 'message' parameter in request body.",
    });
  }

  try {
    let userQuery = await UserQueryModel.findOne({ threadId });

    if (!userQuery) {
      userQuery = await UserQueryModel.create({
        threadId,
        query: userMessage,
        products: [],
        messages: [],
      });
    }


    const currentMessageCount = userQuery.messages?.length || 0;

    if (currentMessageCount >= MAX_MESSAGE_LIMIT) {
      return res.status(400).json({
        success: false,
        error: "Message limit reached",
      });
    }

    const messageHistory: ConversationMessage[] =
      userQuery.messages?.slice(-MESSAGES_TO_LOAD) || [];

    const localState = new LocalState();
    const hasProducts = userQuery.products && userQuery.products.length > 0;

    const agentResponse = await runAgent({
      userMessage,
      messageHistory,
      products: hasProducts ? userQuery.products : undefined,
      originalQuery: userQuery.query || userMessage,
      localState,
    });

    const newUserMessage: ConversationMessage = {
      type: "text",
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    const messagesToAdd: ConversationMessage[] = [newUserMessage];

    const hasProductsInState = localState.has("products");
    const products = localState.get<ScoredProduct[]>("products") || [];

    let assistantMessage: ConversationMessage;

    if (hasProductsInState && products.length > 0) {
      assistantMessage = {
        type: "product-view",
        role: "assistant",
        products: products.map((p) => {
          const productWithVerdict = p as ScoredProduct & { verdict: string };
          return {
            images: p.images,
            specs: p.specs,
            title: p.title,
            price: p.price,
            verdict: productWithVerdict.verdict || "",
            link: p.link,
            brand: p.brand,
            dbRecordId: p.dbRecordId,
          };
        }),
        content: agentResponse.text || "I looked and I found these options",
        timestamp: new Date(),
      };

      userQuery.products = products;
      if (!userQuery.query || userQuery.query.trim().length === 0) {
        userQuery.query = userMessage;
      }
    } else {
      assistantMessage = {
        type: "text",
        role: "assistant",
        content: agentResponse.text,
        timestamp: new Date(),
      };
    }

    messagesToAdd.push(assistantMessage);

    const updatedMessages = [...(userQuery.messages || []), ...messagesToAdd];

    userQuery.messages = updatedMessages;
    await userQuery.save();

    const response = {
      success: true,
      threadId: userQuery.threadId,
      response: agentResponse.text,
      message: assistantMessage,
      steps: agentResponse.steps,
      messageCount: updatedMessages.length,
    };

    return res.json(response);
  } catch (error: unknown) {
    console.error("[Conversation] Error:", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to process conversation",
    });
  }
};
