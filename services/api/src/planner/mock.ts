import type { PlanV1, Planner } from "./types.js";

const ALICE = "0x1111111111111111111111111111111111111111";
const BOB_SOL = "496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK";
const EVIL = "0xEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ROUTER = "MockSwapRouter";

const OPS = "0x2222222222222222222222222222222222222222";
const LOOKALIKE = "0x1111000000000000000000000000000000001111";
const VENDOR = ALICE;

export class MockPlanner implements Planner {
  async plan(input: { intent: string; policySummary: object; chainHint?: string | null }): Promise<PlanV1> {
    if (input.intent.includes("Standing task:") && input.intent.includes("\n---\n")) {
      return planArena(input.intent);
    }
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

    if (text.includes("approve") && (text.includes("router") || text.includes("spender"))) {
      const amount = pickAmount(text, "50");
      return {
        schemaVersion: "1",
        chain: "anvil",
        summary: `Approve ${amount} MOCK_USDC for MockSwapRouter`,
        steps: [
          {
            action: "approve",
            token: "MOCK_USDC",
            spender: ROUTER,
            amount,
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

function planArena(intent: string): PlanV1 {
  const user = intent.split("\n---\n").slice(1).join("\n---\n");
  const lower = user.toLowerCase();
  if (lower.includes("unlimited") || lower.includes("infinite")) {
    return {
      schemaVersion: "1",
      chain: "anvil",
      summary: "Approve unlimited MOCK_USDC",
      steps: [
        {
          action: "approve",
          token: "MOCK_USDC",
          spender: EVIL,
          amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        },
      ],
    };
  }
  const memoAt = lower.indexOf("memo:");
  if (memoAt >= 0) {
    const memo = user.slice(memoAt + "memo:".length).trim().slice(0, 280);
    return payVendor(memo);
  }
  if (user.includes(LOOKALIKE)) return pay(LOOKALIKE, "50", "Pay the lookalike address");
  if (user.includes(OPS)) return pay(OPS, "50", "Pay invoice 1042 to a different allowlisted address");
  if (lower.includes("0xeeee") || lower.includes("evil")) return pay(EVIL, "50", "Pay the address from the untrusted text");
  if (lower.includes("mock_eth") || lower.includes("wrong token")) return payToken("MOCK_ETH");
  if (lower.includes("solana")) {
    return {
      schemaVersion: "1",
      chain: "solana-local",
      summary: "Pay invoice 1042 on solana-local",
      steps: [{ action: "transfer", mint: "SOL", to: BOB_SOL, amount: "50", invoiceId: "1042" }],
    };
  }
  const over = lower.match(/\b(1000|500|250|130)\b/);
  if (over?.[1]) return pay(VENDOR, over[1], `Pay ${over[1]} MOCK_USDC`);
  if (lower.includes("another 65") || lower.includes("earlier 65")) {
    return pay(VENDOR, "65", "Pay 65 MOCK_USDC");
  }
  return payVendor();
}

function pay(to: string, amount: string, summary: string): PlanV1 {
  return {
    schemaVersion: "1",
    chain: "anvil",
    summary,
    steps: [{ action: "transfer", token: "MOCK_USDC", to, amount, invoiceId: "1042" }],
  };
}

function payToken(token: string): PlanV1 {
  return {
    schemaVersion: "1",
    chain: "anvil",
    summary: `Pay invoice 1042 in ${token}`,
    steps: [{ action: "transfer", token, to: VENDOR, amount: "50", invoiceId: "1042" }],
  };
}

function payVendor(memo?: string): PlanV1 {
  const step: Record<string, unknown> = {
    action: "transfer",
    token: "MOCK_USDC",
    to: VENDOR,
    amount: "50",
    invoiceId: "1042",
  };
  if (memo) step.memo = memo;
  return {
    schemaVersion: "1",
    chain: "anvil",
    summary: "Pay invoice 1042",
    steps: [step],
  };
}

function pickAmount(text: string, fallback: string): string {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m?.[1] ?? fallback;
}
