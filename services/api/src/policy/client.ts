import { config } from "../config.js";

export type PolicyRules = {
  maxSteps: number;
  maxAmount: string;
  chains: string[];
  actions: Record<string, string[]>;
  allowRecipients: Record<string, string[]>;
  allowTokens: Record<string, string[]>;
  maxSlippageBps: number;
  forbidInfiniteApprove: boolean;
  allowAutonomous: boolean;
};

export type ValidateResult = {
  ok: boolean;
  schemaErrors: string[];
  policyCodes: string[];
  humanMessages: string[];
};

export type PolicyContext = {
  agentWindow?: string;
  recipientWindow?: string;
  windowCap?: string;
  invoiceId?: string;
  paidInvoices?: string[];
  expectedRecipient?: string;
  expectedToken?: string;
  expectedChain?: string;
  expectedAmount?: string;
  priorTurn?: string;
};

export async function validatePlan(
  plan: unknown,
  policy: { version: number; rules: PolicyRules },
  context?: PolicyContext,
): Promise<ValidateResult> {
  const r = await fetch(`${config.policyServiceUrl}/v1/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, policy, context: context ?? {} }),
  });
  if (!r.ok) {
    throw new Error(`policy service ${r.status}`);
  }
  const raw = (await r.json()) as Partial<ValidateResult>;
  return {
    ok: Boolean(raw.ok),
    schemaErrors: raw.schemaErrors ?? [],
    policyCodes: raw.policyCodes ?? [],
    humanMessages: raw.humanMessages ?? [],
  };
}

export const defaultRules: PolicyRules = {
  maxSteps: 5,
  maxAmount: "100",
  chains: ["anvil", "solana-local"],
  actions: {
    anvil: ["approve", "transfer", "swap"],
    "solana-local": ["transfer"],
  },
  allowRecipients: {
    anvil: [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ],
    "solana-local": ["496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK"],
  },
  allowTokens: {
    anvil: ["MOCK_USDC", "MOCK_ETH"],
    "solana-local": ["SOL", "MOCK_USDC"],
  },
  maxSlippageBps: 100,
  forbidInfiniteApprove: true,
  allowAutonomous: false,
};
