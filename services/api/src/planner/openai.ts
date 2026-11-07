import type { PlanV1, Planner, PlannerCallMeta, PlannerUsage } from "./types.js";
import { SYSTEM_PROMPT, parsePlanContent } from "./planJson.js";

export type ChatCompletionBody = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  response_format?: { type: "json_object" };
};

export type ChatCompletionResult = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type ChatCompletionsFn = (body: ChatCompletionBody) => Promise<ChatCompletionResult>;

export function postChatCompletions(opts: { apiKey: string; baseUrl?: string }): ChatCompletionsFn {
  const baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return async (body) => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`openai ${res.status}`);
    }
    return (await res.json()) as ChatCompletionResult;
  };
}

export class OpenAIPlanner implements Planner {
  private readonly model: string;
  private readonly chat: ChatCompletionsFn;
  private callMeta: PlannerCallMeta = {};

  constructor(opts: { apiKey: string; model: string; chat?: ChatCompletionsFn; baseUrl?: string }) {
    if (!opts.chat && !opts.apiKey) {
      throw new Error("PLANNER=openai requires OPENAI_API_KEY");
    }
    this.model = opts.model;
    this.chat = opts.chat ?? postChatCompletions({ apiKey: opts.apiKey, baseUrl: opts.baseUrl });
  }

  lastPlannerMeta(): PlannerCallMeta {
    return this.callMeta;
  }

  async plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1> {
    this.callMeta = { model: this.model, usage: null };
    const result = await this.chat({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Intent: ${input.intent}`,
            `Chain hint: ${input.chainHint ?? "none"}`,
            `Policy: ${JSON.stringify(input.policySummary)}`,
          ].join("\n"),
        },
      ],
    });
    this.callMeta = {
      model: result.model ?? this.model,
      usage: usageFromResult(result),
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("planner empty completion");
    }
    return parsePlanContent(content);
  }
}

function usageFromResult(result: ChatCompletionResult): PlannerUsage | null {
  const promptTokens = result.usage?.prompt_tokens;
  const completionTokens = result.usage?.completion_tokens;
  if (typeof promptTokens !== "number" || typeof completionTokens !== "number") {
    return null;
  }
  return { promptTokens, completionTokens };
}

