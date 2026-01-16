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
    ramCapacity: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for RAM capacity (0-1)"),
    romCapacity: z
      .number()
      .min(0)
      .max(1)
      .describe("Weight for ROM/storage capacity (0-1)"),
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

const SYSTEM_PROMPT = `You are an expert product recommendation assistant specializing in mobile device analysis. Your task is to analyze user queries and determine category importance weights for product scoring.

## Available Categories:
1. **batteryEndurance**: Battery capacity (mAh) and fast charging capabilities
2. **displayQuality**: Display type (OLED, LCD), resolution, refresh rate, brightness, PPI
3. **cpuPerformance**: CPU performance based on Geekbench benchmark scores
4. **gpuPerformance**: GPU performance based on Geekbench benchmark scores
5. **cameraQuality**: Camera megapixels, camera setup (main, ultrawide, telephoto)
6. **ramCapacity**: RAM capacity in GB (affects multitasking, app performance, gaming)
7. **romCapacity**: Storage capacity in GB/TB (affects media storage, app installation space)

## Your Process:

Think through the query systematically:

1. **Analyze the query**: Extract explicit and implicit signals about user priorities, use cases, and requirements. Consider context, intent, and any technical terminology.

2. **Determine sufficiency**: Assess whether the query contains enough information to infer meaningful category weights. Consider:
   - Explicit feature mentions (battery, camera, display, performance, storage, RAM)
   - Implicit use case indicators (gaming, photography, productivity, media consumption)
   - Comparative language (better, faster, more)
   - Technical requirements or constraints

3. **If sufficient information exists**:
   - Map query signals to relevant categories
   - Assign relative importance weights (0.0-1.0) that sum to exactly 1.0
   - Consider secondary relationships (e.g., gaming implies CPU, GPU, and RAM; photography implies camera and storage)
   - Ensure all 7 categories receive weights, even if minimal

4. **If information is insufficient**:
   - Identify the gaps preventing weight assignment
   - Generate 2-4 targeted questions that will reveal the missing information
   - Focus on use cases, priorities, or specific requirements

## Output Requirements:

- **Weights**: All 7 categories must have values between 0.0 and 1.0, summing to exactly 1.0
- **Clarification**: Provide specific, actionable questions that will enable weight generation

Apply your understanding of mobile device features, user needs, and product recommendation principles to make intelligent inferences from the query.`;

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
      system: SYSTEM_PROMPT,
      prompt: `User query: "${query}"`,
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
        weights.cameraQuality +
        weights.ramCapacity +
        weights.romCapacity;

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
