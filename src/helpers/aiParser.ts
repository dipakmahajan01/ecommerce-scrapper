import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const ParsedQuerySchema = z.object({
  productKeywords: z.string(),
  maxPrice: z.number().int().positive().nullable(),
  minPrice: z.number().int().positive().nullable(),
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

export async function parseUserQueryWithAI(raw: string): Promise<ParsedQuery> {
  // allow overriding model via env var for flexibility
  const requestedModel = process.env.GEMINI_MODEL || "gemini-1.5-pro";

  const prompt = `
You extract Flipkart search parameters from user text.
Return a JSON object with: productKeywords (string), maxPrice (number or null, INR), minPrice (number or null, INR).
User text: "${raw}"
Return ONLY valid JSON.
`;

  try {
    const model = genAI.getGenerativeModel({ model: requestedModel });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const json = JSON.parse(text);
    return ParsedQuerySchema.parse(json);
  } catch (err: any) {
    // If model is not found or API version mismatch, try to list available models to help debugging
    console.error('[AI] generateContent failed for model:', requestedModel, '\nError:', err?.message || err);
    try {
      // SDK versions may differ; call listModels only if available.
      const listFn = (genAI as any).listModels;
      if (typeof listFn === 'function') {
        const models = await listFn.call(genAI);
        console.error('[AI] Available models:', JSON.stringify(models, null, 2));
      } else {
        console.error('[AI] listModels() is not available on this SDK instance.');
      }
    } catch (listErr) {
      console.error('[AI] Failed to list models:', listErr);
    }

    throw new Error(
      `AI model error: failed to generate content using model "${requestedModel}". ` +
        `Check server logs for available models and update GEMINI_MODEL environment variable to a supported model name.`,
    );
  }
}
