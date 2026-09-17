import type { PlanV1, Planner } from "./types.js";

export type ChatCompletionBody = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  response_format?: { type: "json_object" };
};

export type ChatCompletionResult = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export type ChatCompletionsFn = (body: ChatCompletionBody) => Promise<ChatCompletionResult>;

const SYSTEM_PROMPT = `Convert the user's chain intent into a Guardrail PlanV1 JSON object.
Reply with JSON only. No markdown, no tools, no calldata, no hex, no serialized instructions.
Use symbolic token names (MOCK_USDC, MOCK_ETH, SOL) and decimal string amounts.
Chains: anvil (approve, transfer, swap) or solana-local (transfer only). 1 to 5 steps. No extra keys.
Shape: {"schemaVersion":"1","chain":"anvil"|"solana-local","summary":string,"steps":[...]}
approve: {"action":"approve","token","spender","amount"}
evm transfer: {"action":"transfer","token","to","amount"}
swap: {"action":"swap","tokenIn","tokenOut","amountIn","minAmountOut","maxSlippageBps"}
solana transfer: {"action":"transfer","mint","to","amount"}`;

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

  constructor(opts: { apiKey: string; model: string; chat?: ChatCompletionsFn; baseUrl?: string }) {
    this.model = opts.model;
    this.chat = opts.chat ?? postChatCompletions({ apiKey: opts.apiKey, baseUrl: opts.baseUrl });
  }

  async plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1> {
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
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("planner empty completion");
    }
    return parsePlanJson(content);
  }
}

function parsePlanJson(content: string): PlanV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(content));
  } catch {
    throw new Error("planner returned non-json");
  }
  return asPlanV1(parsed);
}

function unwrapJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}

function asPlanV1(value: unknown): PlanV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("planner returned non-object");
  }
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== "1") {
    throw new Error("planner schemaVersion");
  }
  if (v.chain !== "anvil" && v.chain !== "solana-local") {
    throw new Error("planner chain");
  }
  if (typeof v.summary !== "string" || v.summary.length === 0) {
    throw new Error("planner summary");
  }
  if (!Array.isArray(v.steps) || v.steps.length === 0) {
    throw new Error("planner steps");
  }
  const steps: Array<Record<string, unknown>> = [];
  for (const step of v.steps) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new Error("planner step");
    }
    steps.push(step as Record<string, unknown>);
  }
  return { schemaVersion: "1", chain: v.chain, summary: v.summary, steps };
}
