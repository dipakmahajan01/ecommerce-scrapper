import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import { BudgetInfo } from "../service/ai/types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const BudgetInfoSchema = z
  .object({
    budget: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe("Budget amount in INR (null if not specified)"),
    extensionAmount: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        "Extension amount in INR if user is OK extending budget (null if user not OK extending or if not specified)"
      ),
  })
  .strict();

export const ParsedQuerySchema = z
  .object({
    responseType: z
      .enum(["parsed", "clarification"])
      .describe(
        "Use 'parsed' when query can be parsed successfully. Use 'clarification' when budget/extension information is missing and needs clarification."
      ),
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
    budgetInfo: BudgetInfoSchema.nullable().describe(
      "Budget information extracted from query. Present when responseType is 'parsed' and budget is mentioned. Null if budget not specified or when responseType is 'clarification'."
    ),
    questions: z
      .array(z.string())
      .nullable()
      .describe(
        "Present only when responseType is 'clarification'. List of follow-up questions needed to clarify budget/extension information. Omit when responseType is 'parsed'."
      ),
  })
  .strict();

export type ParsedQuery = {
  query: string;
  maxPrice: number | null;
  minPrice: number | null;
  brands: string[] | null;
  storage: string | null;
  ram: string[] | null;
  budgetInfo: BudgetInfo | undefined;
};

export type ParsedQueryResult =
  | { success: true; parsed: ParsedQuery }
  | { success: false; questions: string[] };

const SYSTEM_PROMPT = `Extract simple Flipkart search parameters and budget information from the user's query.

## Your Process:

1. **Extract Search Parameters**:
   - query: Short, keyword-based search string. Do not use natural language or sentences. Only include the brand, product type, storage, and RAM if specified, and optionally the upper price limit (max price) if given in the query as "under"/"below"/"max". Do not include minimum price or full filter details in the query; filters will be applied separately.
   - maxPrice: Number (INR) or null. Use for phrases like "under 30000", "below 30k", "max 30000".
   - minPrice: Number (INR) or null. Use for phrases like "above 10000", "from 10k", "min 10000".
   - brands: Array of brand names or null.
   - storage: Storage string or null (e.g., "128 GB").
   - ram: Array of RAM options or null (e.g., ["4 GB"]).

2. **Extract Budget Information**:
   - Look for explicit budget mentions: "under 30000", "around 25000", "max 40k", "budget of 20k"
   - Determine if user is OK extending budget:
     - **User OK extending signals**: "can extend by X", "flexible up to X", "can go beyond by X", "willing to pay X more", "can stretch by X"
       - If found, set extensionAmount = the mentioned amount in INR (must be a number)
     - **User NOT OK extending signals**: "Can't extend this is my limit", "don't extend", "no flexibility", "this is my limit", "cannot exceed", "strictly under X", "exactly X", "not more than X", "hard limit X"
       - If found, set extensionAmount = null
     - **Default**: If budget mentioned but extension willingness unclear → set extensionAmount = null (user not OK extending, system will apply automatic buffer)
   - If budget not mentioned at all → set budgetInfo to null

3. **Determine if clarification is needed**:
   - If budget mentioned but user says OK extending but amount not specified → ask clarification: "How much can you extend your budget?"
   - If no budget mentioned and query is too generic → you may ask about budget, but prioritize parsing what's available
   - If sufficient information exists → use responseType = "parsed"
   - If clarification needed for budget/extension → use responseType = "clarification" and provide questions

## Output Requirements:

- **responseType**: "parsed" when query can be parsed, "clarification" when budget/extension info needs clarification
- **query**: Minimal, clean keyword query
- **maxPrice, minPrice, brands, storage, ram**: Extract from query, set to null if not mentioned
- **budgetInfo**: Extract budget and extensionAmount if budget mentioned. Set to null if budget not specified.
- **questions**: Present only when responseType is "clarification". Focus on budget/extension clarification.

## Examples:

"I want an Apple iPhone under 50000" → {responseType: "parsed", query: "iphone under 50k", maxPrice: 50000, minPrice: null, brands: ["Apple"], storage: null, ram: null, budgetInfo: {budget: 50000, extensionAmount: null}, questions: null}

"Show me smartphones with budget 30000, can extend by 2000" → {responseType: "parsed", query: "smartphones", maxPrice: null, minPrice: null, brands: null, storage: null, ram: null, budgetInfo: {budget: 30000, extensionAmount: 2000}, questions: null}

"Smartphones under 40000, can extend" → {responseType: "clarification", query: "smartphones", maxPrice: 40000, minPrice: null, brands: null, storage: null, ram: null, budgetInfo: null, questions: ["How much can you extend your budget?"]}

"Can't extend this is my limit, budget 25000" → {responseType: "parsed", query: "smartphones", maxPrice: null, minPrice: null, brands: null, storage: null, ram: null, budgetInfo: {budget: 25000, extensionAmount: null}, questions: null}

Strictly follow these instructions. Extract all search parameters and budget information. Ask clarification only when budget extension amount is missing but user indicated willingness to extend.`;

export async function parseUserQueryWithAI(
  raw: string
): Promise<ParsedQueryResult> {
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

    if (object.responseType === "parsed") {
      return {
        success: true,
        parsed: {
          query: object.query,
          maxPrice: object.maxPrice,
          minPrice: object.minPrice,
          brands: object.brands,
          storage: object.storage,
          ram: object.ram,
          budgetInfo:
            object.budgetInfo && object.budgetInfo.budget !== null
              ? {
                  budget: object.budgetInfo.budget,
                  extensionAmount: object.budgetInfo.extensionAmount,
                }
              : undefined,
        },
      };
    } else {
      if (!object.questions || object.questions.length === 0) {
        throw new Error(
          "Questions are required when responseType is 'clarification'"
        );
      }

      return {
        success: false,
        questions: object.questions,
      };
    }
  } catch (error: unknown) {
    console.error("[AI] Error parsing user query:", error);
    throw new Error(
      `Failed to parse user query: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
