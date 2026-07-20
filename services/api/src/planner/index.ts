import { config } from "../config.js";
import { MockPlanner } from "./mock.js";
import type { Planner } from "./types.js";

export function createPlanner(): Planner {
  // openai path can land later; mock is the default for local/CI
  if (config.planner === "openai" && config.openaiApiKey) {
    console.warn("openai planner requested but not configured; using mock");
  }
  return new MockPlanner();
}

export type { Planner, PlanV1 } from "./types.js";
