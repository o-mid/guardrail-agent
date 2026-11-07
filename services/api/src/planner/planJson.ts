import { planV1Schema } from "@guardrail/plan-schema";
import type { PlanV1 } from "./types.js";

export const SYSTEM_PROMPT = `Convert the user's chain intent into a Guardrail PlanV1 JSON object.
Reply with JSON only. No markdown, no tools, no calldata, no hex, no serialized instructions.
Use symbolic token names (MOCK_USDC, MOCK_ETH, SOL) and decimal string amounts.
Chains: anvil (approve, transfer, swap) or solana-local (transfer only). 1 to 5 steps. No extra keys.
Shape: {"schemaVersion":"1","chain":"anvil"|"solana-local","summary":string,"steps":[...]}
approve: {"action":"approve","token","spender","amount"}
evm transfer: {"action":"transfer","token","to","amount"}
swap: {"action":"swap","tokenIn","tokenOut","amountIn","minAmountOut","maxSlippageBps"}
solana transfer: {"action":"transfer","mint","to","amount"}
Optional on transfer: memo (plain string, max 280), invoiceId (short id).`;

export function parsePlanContent(content: string): PlanV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapJson(content));
  } catch {
    throw new Error("planner returned non-json");
  }
  const checked = planV1Schema.safeParse(parsed);
  if (!checked.success) {
    const detail = checked.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`planner schema: ${detail}`);
  }
  return {
    schemaVersion: checked.data.schemaVersion,
    chain: checked.data.chain,
    summary: checked.data.summary,
    steps: checked.data.steps,
  };
}

function unwrapJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced?.[1] ?? trimmed;
}
