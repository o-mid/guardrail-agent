import type { PlanV1, Planner, PlannerCallMeta, PlannerUsage } from "./types.js";
import { SYSTEM_PROMPT, parsePlanContent } from "./planJson.js";

export type AnthropicBody = {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user"; content: string }>;
};

export type AnthropicResult = {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export type MessagesFn = (body: AnthropicBody) => Promise<AnthropicResult>;

export function postMessages(opts: { apiKey: string; baseUrl?: string }): MessagesFn {
  const baseUrl = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  return async (body) => {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`anthropic ${res.status}`);
    }
    return (await res.json()) as AnthropicResult;
  };
}

export class AnthropicPlanner implements Planner {
  private readonly model: string;
  private readonly messagesFn: MessagesFn;
  private callMeta: PlannerCallMeta = {};

  constructor(opts: { apiKey: string; model: string; messages?: MessagesFn; baseUrl?: string }) {
    if (!opts.messages && !opts.apiKey) {
      throw new Error("PLANNER=anthropic requires ANTHROPIC_API_KEY");
    }
    if (!opts.model) {
      throw new Error("PLANNER=anthropic requires ANTHROPIC_MODEL");
    }
    this.model = opts.model;
    this.messagesFn = opts.messages ?? postMessages({ apiKey: opts.apiKey, baseUrl: opts.baseUrl });
  }

  lastPlannerMeta(): PlannerCallMeta {
    return this.callMeta;
  }

  async plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1> {
    this.callMeta = { model: this.model, usage: null };
    const result = await this.messagesFn({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
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
    const content = result.content?.find((block) => block.type === "text")?.text ?? result.content?.[0]?.text;
    if (!content) {
      throw new Error("planner empty completion");
    }
    return parsePlanContent(content);
  }
}

function usageFromResult(result: AnthropicResult): PlannerUsage | null {
  const promptTokens = result.usage?.input_tokens;
  const completionTokens = result.usage?.output_tokens;
  if (typeof promptTokens !== "number" || typeof completionTokens !== "number") {
    return null;
  }
  return { promptTokens, completionTokens };
}
