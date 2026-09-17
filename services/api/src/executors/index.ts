import { Plan, PlanStep } from "../models/index.js";
import { setStepRunner, type ExecResult, type StoredPlanForPolicy } from "../services/execution.js";
import { executeEvmStep } from "./evm.js";
import { executeSolanaStep } from "./solana.js";

export function registerExecutors(): void {
  setStepRunner(async (planId, stepIndex) => {
    const plan = await Plan.findById(planId);
    const steps = await PlanStep.find({ planId }).sort({ index: 1 });
    const step = steps.find((s) => s.index === stepIndex);
    if (!plan || !step) return { ok: false, error: "missing_plan_or_step" };

    const stored: StoredPlanForPolicy = {
      userId: String(plan.userId),
      schemaVersion: plan.schemaVersion,
      chain: plan.chain,
      summary: plan.summary,
      steps: steps.map((s) => ({ index: s.index, payload: s.payload })),
    };

    if (plan.chain === "anvil") {
      return executeEvmStep(step.payload as Record<string, unknown>, stored);
    }
    if (plan.chain === "solana-local") {
      return executeSolanaStep(step.payload as Record<string, unknown>, stored);
    }
    return { ok: false, error: `unsupported_chain_${plan.chain}` } satisfies ExecResult;
  });
}
