import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { CategoryWeights, ScoredProduct } from "../productRelevanceEngine/types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface GenerateProductVerdictOptions {
  weights: CategoryWeights;
  userQuery: string;
  product: ScoredProduct;
}

const SYSTEM_PROMPT = `You are a buying assistant.

Given the user's query and priorities, generate a 1–2 line summary for the product. 

Rules:
- Start with "Good if..." and "Skip if..."
- Focus only on decision-making factors, not specs
- Use simple, neutral language
- Avoid hype or marketing phrases
- Maximum 30 words total
- Assume low attention span
- Output only the summary
`;

export async function generateProductVerdict({
  weights,
  userQuery,
  product,
}: GenerateProductVerdictOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required but not set"
    );
  }

  const weightsJson = JSON.stringify(weights, null, 2);
  const productSummary = JSON.stringify(
    {
      title: product.title,
      price: product.price,
      specs: product.specs,
      categoryScores: {
        batteryEndurance: product.batteryEndurance,
        displayQuality: product.displayQuality,
        cpuPerformance: product.cpuPerformance,
        gpuPerformance: product.gpuPerformance,
        cameraQuality: product.cameraQuality,
        ramCapacity: product.ramCapacity,
        romCapacity: product.romCapacity,
        totalWeightedScore: product.totalWeightedScore,
      },
    },
    null,
    2
  );

  const prompt = `User's Query: "${userQuery}"

User Priority Weights:
\`\`\`json
${weightsJson}
\`\`\`

Product:
\`\`\`json
${productSummary}
\`\`\`

Given the above, write a decision summary:
Good if... Skip if...
(Max 30 words, focus only on key decision factors, not specs or marketing language.)`;

  const { text } = await generateText({
    model: openrouter.chat("openai/gpt-5.2"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.8,
  });

  return text;
}
