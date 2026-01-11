import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const ParsedQuerySchema = z
  .object({
    query: z
      .string()
      .describe(
        "Natural human-like search query string that includes product keywords and all filters in a conversational way. Examples: 'smartphones under 50k', 'Apple iPhone 128 GB 6 GB RAM under 30000', 'Samsung phones 256 GB between 20k and 40k'. Should read like how a human would type a search query."
      ),
    maxPrice: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Maximum price in INR (null if not specified)"),
    minPrice: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Minimum price in INR (null if not specified)"),
    brands: z
      .array(z.string())
      .nullable()
      .describe(
        "Array of brand names mentioned in the query (e.g., ['Apple', 'Google'], null if not specified)"
      ),
    storage: z
      .string()
      .nullable()
      .describe(
        "Storage specification (e.g., '128-255.9 GB', '256 GB', null if not specified)"
      ),
    ram: z
      .array(z.string())
      .nullable()
      .describe(
        "Array of RAM specifications (e.g., ['4 GB', '6 GB'], null if not specified)"
      ),
  })
  .strict();

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

const SYSTEM_PROMPT = `Extract simple Flipkart search parameters from the user's query.

Output:
- query: Short, keyword-based search string. Do not use natural language or sentences. Only include the brand, product type, storage, and RAM if specified, and optionally the upper price limit (max price) if given in the query as "under"/"below"/"max". Do not include minimum price or full filter details in the query; filters will be applied separately.
- maxPrice: Number (INR) or null. Use for phrases like "under 30000", "below 30k", "max 30000".
- minPrice: Number (INR) or null. Use for phrases like "above 10000", "from 10k", "min 10000".
- brands: Array of brand names or null.
- storage: Storage string or null (e.g., "128 GB").
- ram: Array of RAM options or null (e.g., ["4 GB"]).

Rules:
- The query field must be minimal and concise—never include minimum price, price ranges, or unnecessary filter detail. 
- Only use the maxPrice in the query if present, in the form "under 50k"; do not include minPrice or "between" price phrases in the query.
- Typical query: "samsung smartphone 128 GB", "samsung smartphone 6 GB RAM", "iphone under 40k".
- If both RAM and storage are provided, you may optionally include both in the order: brand, product, storage, RAM, and upper price if given.
- Remove all unnecessary details, filler words, or full filter sets from the query.
- Use "k" for thousands in query (e.g., "50k" for "50000").
- Set each field to null if not mentioned.

Examples:
"I want an Apple iPhone under 50000" → {query: "iphone under 50k", maxPrice: 50000, minPrice: null, brands: ["Apple"], storage: null, ram: null}
"Show me Samsung phones with 128 GB storage and 6 GB RAM between 20000 and 40000" → {query: "samsung smartphone 128 GB 6 GB RAM", maxPrice: 40000, minPrice: 20000, brands: ["Samsung"], storage: "128 GB", ram: ["6 GB"]}
"Google Pixel phones with 256 GB" → {query: "google pixel 256 GB", brands: ["Google"], storage: "256 GB"}
"smartphones" → {query: "smartphones"}

Strictly follow these instructions. Output the minimal, clean keyword query and extract all parameter fields. Never mention the minimum price or use natural language in the query field.`;

export async function parseUserQueryWithAI(raw: string): Promise<ParsedQuery> {
  if (!raw || raw.trim().length === 0) {
    throw new Error("User query cannot be empty");
  }

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY environment variable is required but not set"
      );
    }

    const { object } = await generateObject({
      model: openrouter.chat("openai/gpt-5.2"),
      temperature: 0,
      schema: ParsedQuerySchema,
      prompt: `${SYSTEM_PROMPT}\n\nUser query: "${raw}"`,
    });

    return object;
  } catch (error: unknown) {
    console.error("[AI] Error parsing user query:", error);
    throw new Error(
      `Failed to parse user query: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
