import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
import { z } from "zod";
import { CategoryWeights } from "../productRelevanceEngine/types";
import { WeightGenerationResult } from "./types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const CategoryWeightsSchema = z
  .object({
    batteryEndurance: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for battery endurance (0-1)"),
    displayQuality: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for display quality (0-1)"),
    cpuPerformance: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for CPU performance (0-1)"),
    gpuPerformance: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for GPU performance (0-1)"),
    cameraQuality: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for camera quality (0-1)"),
  })
  .strict();

const WeightGenerationResponseSchema = z
  .object({
    responseType: z
      .enum(["weights", "clarification"])
      .describe(
        "Indicates the intent of the response. Use 'weights' when sufficient context exists to infer category importance. Use 'clarification' when more user input is required."
      ),

    weights: CategoryWeightsSchema.nullable().describe(
      "Present only when responseType is 'weights'. Contains normalized category importance values between 0 and 1 that should sum to 1. Omit when responseType is 'clarification'."
    ),

    questions: z
      .array(z.string())
      .nullable()
      .describe(
        "Present only when responseType is 'clarification'. List of follow-up questions needed to better understand user preferences. Omit when responseType is 'weights'."
      ),
  })
  .strict();

const SYSTEM_PROMPT = `You are an expert product recommendation assistant. Your task is to analyze user queries about mobile devices and generate category weights for product scoring.

## Scoring Categories:
1. **batteryEndurance**: Battery capacity (mAh) and fast charging capabilities
2. **displayQuality**: Display type (OLED, LCD), resolution, refresh rate, brightness, PPI
3. **cpuPerformance**: CPU performance based on Geekbench benchmark scores
4. **gpuPerformance**: GPU performance based on Geekbench benchmark scores
5. **cameraQuality**: Camera megapixels, camera setup (main, ultrawide, telephoto)

## Decision Rules:

### Return "weights" (responseType: "weights") when:
- The query mentions specific features or priorities (e.g., "battery life", "camera", "gaming", "display")
- The query indicates use cases (e.g., "for photography", "for gaming", "for work")
- The query has enough context to infer relative importance of categories
- Examples:
  * "I need a phone with great battery life and good camera" → High batteryEndurance, high cameraQuality
  * "Looking for a gaming phone" → High cpuPerformance, high gpuPerformance
  * "Want excellent display for media" → High displayQuality
  * "Need long battery and fast performance" → High batteryEndurance, high cpuPerformance

### Return "clarification" (responseType: "clarification") when:
- The query is too vague or generic (e.g., "good phone", "recommend something")
- No specific features, priorities, or use cases are mentioned
- The query is a question asking for general advice
- Examples:
  * "I want a good phone" → Needs clarification
  * "What phone should I buy?" → Needs clarification
  * "Recommend me something" → Needs clarification
  * "Best phone" → Needs clarification

## When returning weights:
- ALL 5 weights MUST be provided
- Each weight must be between 0.0 and 1.0
- The sum of all 5 weights MUST equal exactly 1.0
- Higher weights indicate higher importance for that category based on the user's query
- Example: If user says "gaming phone", cpuPerformance and gpuPerformance should have higher weights

## When returning clarification:
- Provide 2-4 specific, helpful questions
- Questions should help understand: use case, priorities, preferences, or requirements
- Make questions actionable and easy to answer

Analyze the user query and respond with the appropriate responseType and corresponding fields.`;

export async function generateCategoryWeights(
  query: string
): Promise<WeightGenerationResult> {
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      clarifyingQuestions: {
        requiresClarification: true,
        questions: [
          "What is your primary use case for the phone? (gaming, photography, daily use, etc.)",
          "Which features are most important to you? (battery, display, camera, performance)",
          "Do you have any specific requirements or preferences?",
        ],
      },
    };
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
      schema: WeightGenerationResponseSchema,
      prompt: `${SYSTEM_PROMPT}\n\nUser query: "${query}"`,
    });

    if (object.responseType === "weights") {
      if (!object.weights) {
        throw new Error("Weights are required when responseType is 'weights'");
      }

      const weights = object.weights;
      const sum =
        weights.batteryEndurance +
        weights.displayQuality +
        weights.cpuPerformance +
        weights.gpuPerformance +
        weights.cameraQuality;

      if (Math.abs(sum - 1.0) > 0.01) {
        throw new Error(
          `Weights must sum to 1.0, but got ${sum}. Please ensure all weights are normalized.`
        );
      }

      return {
        success: true,
        weights: weights,
      };
    } else {
      if (!object.questions || object.questions.length === 0) {
        throw new Error(
          "Questions are required when responseType is 'clarification'"
        );
      }

      return {
        success: false,
        clarifyingQuestions: {
          requiresClarification: true,
          questions: object.questions,
        },
      };
    }
  } catch (error: any) {
    console.error("[AI] Error generating category weights:", error);
    throw new Error(
      `Failed to generate category weights: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
