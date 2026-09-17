import { config } from "../config.js";
import { MockPlanner } from "./mock.js";
import { OpenAIPlanner, type ChatCompletionsFn } from "./openai.js";
import type { Planner } from "./types.js";

export function createPlanner(chat?: ChatCompletionsFn): Planner {
  const mode = process.env.PLANNER ?? config.planner;
  const key = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? config.openaiModel;
  if (mode === "openai" && key) {
    return new OpenAIPlanner({ apiKey: key, model, chat });
  }
  if (mode === "openai") {
    console.warn("openai planner requested without OPENAI_API_KEY; using mock");
  }
  return new MockPlanner();
}

export type { Planner, PlanV1 } from "./types.js";
export { OpenAIPlanner } from "./openai.js";

