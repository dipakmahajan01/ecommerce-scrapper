import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { ScoredProduct } from "../productRelevanceEngine/types";
import { IConversationMessage } from "../../models/userQuery";
import { buildSystemPrompt } from "../agent/prompts";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface GenerateConversationResponseOptions {
  products: ScoredProduct[];
  messageHistory: IConversationMessage[];
  userMessage: string;
  originalQuery: string;
}

export async function generateConversationResponse({
  products,
  messageHistory,
  userMessage,
  originalQuery,
}: GenerateConversationResponseOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required but not set"
    );
  }

  const systemPrompt = buildSystemPrompt(products, originalQuery);

  const textMessages = messageHistory
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
    .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...textMessages,
    { role: "user" as const, content: userMessage },
  ];

  const { text } = await generateText({
    model: openrouter.chat("openai/gpt-5.2"),
    messages,
    temperature: 0.7,
  });

  return text;
}
