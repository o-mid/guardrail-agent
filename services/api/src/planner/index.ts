import { config } from "../config.js";
import { AnthropicPlanner, type MessagesFn } from "./anthropic.js";
import { MockPlanner } from "./mock.js";
import { OpenAIPlanner, type ChatCompletionsFn } from "./openai.js";
import type { Planner } from "./types.js";

export function createPlanner(chat?: ChatCompletionsFn, messages?: MessagesFn): Planner {
  const mode = process.env.PLANNER ?? config.planner;
  if (mode === "openai") {
    const key = process.env.OPENAI_API_KEY ?? "";
    const model = process.env.OPENAI_MODEL ?? config.openaiModel;
    if (!key) {
      throw new Error("PLANNER=openai requires OPENAI_API_KEY");
    }
    return new OpenAIPlanner({ apiKey: key, model, chat });
  }
  if (mode === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY ?? "";
    const model = process.env.ANTHROPIC_MODEL ?? "";
    if (!key) {
      throw new Error("PLANNER=anthropic requires ANTHROPIC_API_KEY");
    }
    if (!model) {
      throw new Error("PLANNER=anthropic requires ANTHROPIC_MODEL");
    }
    return new AnthropicPlanner({ apiKey: key, model, messages });
  }
  if (mode === "mock") {
    return new MockPlanner();
  }
  throw new Error(`PLANNER=${mode} is not mock, openai, or anthropic`);
}

export type { Planner, PlanV1, PlannerUsage, PlannerCallMeta } from "./types.js";
export { OpenAIPlanner } from "./openai.js";
export { AnthropicPlanner } from "./anthropic.js";
