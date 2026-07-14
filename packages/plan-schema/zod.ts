import { z } from "zod";

const decimalAmount = z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const evmToken = z.enum(["MOCK_USDC", "MOCK_ETH"]);

const approveStep = z
  .object({
    action: z.literal("approve"),
    token: evmToken,
    spender: z.string().min(1),
    amount: decimalAmount,
  })
  .strict();

const swapStep = z
  .object({
    action: z.literal("swap"),
    tokenIn: evmToken,
    tokenOut: evmToken,
    amountIn: decimalAmount,
    minAmountOut: decimalAmount,
    maxSlippageBps: z.number().int().min(0).max(500),
  })
  .strict();

const transferStep = z
  .object({
    action: z.literal("transfer"),
    token: evmToken,
    to: z.string().min(1),
    amount: decimalAmount,
  })
  .strict();

const solanaTransferStep = z
  .object({
    action: z.literal("transfer"),
    mint: z.enum(["SOL", "MOCK_USDC"]),
    to: z.string().min(1),
    amount: decimalAmount,
  })
  .strict();

export const planStepSchema = z.union([approveStep, swapStep, transferStep, solanaTransferStep]);

export const planV1Schema = z
  .object({
    schemaVersion: z.literal("1"),
    chain: z.enum(["anvil", "solana-local"]),
    summary: z.string().min(1).max(240),
    steps: z.array(planStepSchema).min(1).max(5),
  })
  .strict()
  .superRefine((plan, ctx) => {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (plan.chain === "anvil" && "mint" in step) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `step ${i}: mint not valid on anvil`, path: ["steps", i] });
      }
      if (plan.chain === "solana-local" && "token" in step) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `step ${i}: token not valid on solana-local`, path: ["steps", i] });
      }
      if (plan.chain === "solana-local" && step.action !== "transfer") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `step ${i}: only transfer on solana-local`, path: ["steps", i] });
      }
    }
  });

export type PlanV1 = z.infer<typeof planV1Schema>;
export type PlanStep = z.infer<typeof planStepSchema>;
