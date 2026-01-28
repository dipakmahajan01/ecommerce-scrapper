import { Request, Response } from "express";
import { UserQueryModel } from "../models/userQuery";
import { generateConversationResponse } from "../service/conversation";
import { IConversationMessage as ConversationMessage } from "../models/userQuery";

const MAX_MESSAGE_LIMIT = 50;
const MESSAGES_TO_LOAD = 6;

export const handleConversation = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userMessage = (req.body?.message as string) || "";

  if (!id || id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing 'id' parameter in request path.",
    });
  }

  if (!userMessage || userMessage.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: "Missing 'message' parameter in request body.",
    });
  }

  try {
    const userQuery = await UserQueryModel.findById(id);

    if (!userQuery) {
      return res.status(404).json({
        success: false,
        error: `No UserQuery found with id: ${id}`,
      });
    }

    const currentMessageCount = userQuery.messages?.length || 0;

    if (currentMessageCount >= MAX_MESSAGE_LIMIT) {
      return res.status(400).json({
        success: false,
        error: "Message limit reached",
      });
    }

    if (!userQuery.products || userQuery.products.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No products available for this conversation.",
      });
    }

    const messageHistory: ConversationMessage[] =
      userQuery.messages?.slice(-MESSAGES_TO_LOAD) || [];

    const assistantResponse = await generateConversationResponse({
      products: userQuery.products,
      messageHistory,
      userMessage,
      originalQuery: userQuery.query,
    });

    const newUserMessage: ConversationMessage = {
      type: "text",
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    };

    const newAssistantMessage: ConversationMessage = {
      type: "text",
      role: "assistant",
      content: assistantResponse,
      timestamp: new Date(),
    };

    const updatedMessages = [
      ...(userQuery.messages || []),
      newUserMessage,
      newAssistantMessage,
    ];

    userQuery.messages = updatedMessages;
    await userQuery.save();

    return res.json({
      success: true,
      response: assistantResponse,
      messageCount: updatedMessages.length,
    });
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
