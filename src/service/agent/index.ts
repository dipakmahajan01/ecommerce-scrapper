import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs } from "ai";
import { ScoredProduct } from "../productRelevanceEngine/types";
import { IConversationMessage } from "../../models/userQuery";
import { buildAgenticModePrompt } from "./prompts";
import { createProductRecommendationTool } from "./productRecommendationTool";
import { LocalState } from "./localState";
import { generateConversationResponse } from "../conversation";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface AgentResponse {
  text: string;
  steps: Array<any>;
  totalUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface AgentOptions {
  userMessage: string;
  messageHistory: IConversationMessage[];
  products?: ScoredProduct[];
  originalQuery?: string;
  localState: LocalState;
}

export async function runAgent({
  userMessage,
  messageHistory,
  products,
  originalQuery,
  localState,
}: AgentOptions): Promise<AgentResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required but not set"
    );
  }

  const hasProducts = products && products.length > 0;

  if (hasProducts && originalQuery) {
    console.log("CONVERSATION LLM CALLED")
    return runConversationMode({
      userMessage,
      messageHistory,
      products,
      originalQuery,
    });
  }

  return runAgenticMode({
    userMessage,
    messageHistory,
    localState,
  });
}

async function runAgenticMode({
  userMessage,
  messageHistory,
  localState,
}: {
  userMessage: string;
  messageHistory: IConversationMessage[];
  localState: LocalState;
}): Promise<AgentResponse> {
  const systemPrompt = buildAgenticModePrompt();

  const productRecommendationTool = createProductRecommendationTool(localState);

  const messages = messageHistory
    .map((msg) => {
      if (msg.type === "text") {
        return {
          role: msg.role,
          content: msg.content,
        };
      }
      if (msg.type === "product-view") {
        const productsList = msg.products
          .map((p) => `Product: ${p.title}\nVerdict: ${p.verdict}`)
          .join("\n\n");
        return {
          role: "assistant" as const,
          content: `${msg.content}\n\n${productsList}`,
        };
      }
      return null;
    })
    .filter((msg): msg is { role: "user" | "assistant"; content: string } => msg !== null);

  const { text, steps, usage: totalUsage } = await generateText({
    model: openrouter.chat("openai/gpt-4.1-mini"),
    tools: {
      productRecommendation: productRecommendationTool,
    },
    stopWhen: stepCountIs(5),
    prepareStep: ({ messages }) => {
      return {
        messages: messages.slice(-12),
      };
    },
    system: systemPrompt,
    messages: [
      ...messages,
      { role: "user", content: userMessage },
    ]
  });

  return {
    text,
    steps: steps,
    totalUsage: {
      inputTokens: totalUsage?.inputTokens || 0,
      outputTokens: totalUsage?.outputTokens || 0,
      totalTokens: totalUsage?.totalTokens || 0,
    },
  };
}

async function runConversationMode({
  userMessage,
  messageHistory,
  products,
  originalQuery,
}: {
  userMessage: string;
  messageHistory: IConversationMessage[];
  products: ScoredProduct[];
  originalQuery: string;
}): Promise<AgentResponse> {
  const text = await generateConversationResponse({
    products,
    messageHistory,
    userMessage,
    originalQuery,
  });

  return {
    text,
    steps: [],
    totalUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  };
}
