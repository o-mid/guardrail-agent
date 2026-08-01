import type { PlanV1, Planner } from "./types.js";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB_SOL = "496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK";
const EVIL = "0xEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export class MockPlanner implements Planner {
  async plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1> {
    const text = input.intent.toLowerCase();

    if (text.includes("unlimited") || text.includes("infinite") || (text.includes("approve") && text.includes("evil"))) {
      return {
        schemaVersion: "1",
        chain: "anvil",
        summary: "Approve unlimited MOCK_USDC for spender",
        steps: [
          {
            action: "approve",
            token: "MOCK_USDC",
            spender: EVIL,
            // decimal string that passes schema, blocked by infinite_approve policy
            amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
          },
        ],
      };
    }

    if (text.includes("sol") || text.includes("bob")) {
      const amount = pickAmount(text, "0.1");
      return {
        schemaVersion: "1",
        chain: "solana-local",
        summary: `Transfer ${amount} SOL to allowlisted pubkey`,
        steps: [
          {
            action: "transfer",
            mint: "SOL",
            to: BOB_SOL,
            amount,
          },
        ],
      };
    }

    if (text.includes("swap")) {
      const amount = pickAmount(text, "10");
      return {
        schemaVersion: "1",
        chain: "anvil",
        summary: `Swap ${amount} MOCK_USDC for MOCK_ETH`,
        steps: [
          {
            action: "swap",
            tokenIn: "MOCK_USDC",
            tokenOut: "MOCK_ETH",
            amountIn: amount,
            minAmountOut: "0.001",
            maxSlippageBps: 50,
          },
        ],
      };
    }

    const amount = pickAmount(text, "5");
    const to = text.includes("evil") ? EVIL : ALICE;
    return {
      schemaVersion: "1",
      chain: input.chainHint === "solana-local" ? "solana-local" : "anvil",
      summary: `Transfer ${amount} MOCK_USDC to ${to === ALICE ? "allowlisted recipient" : "recipient"}`,
      steps: [
        {
          action: "transfer",
          token: "MOCK_USDC",
          to,
          amount,
        },
      ],
    };
  }
}

function pickAmount(text: string, fallback: string): string {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m?.[1] ?? fallback;
}
