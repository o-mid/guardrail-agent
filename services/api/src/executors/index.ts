import { Plan, PlanStep } from "../models/index.js";
import { setStepRunner, type ExecResult } from "../services/execution.js";
import { executeEvmStep } from "./evm.js";
import { executeSolanaStep } from "./solana.js";

export function registerExecutors(): void {
  setStepRunner(async (planId, stepIndex) => {
    const plan = await Plan.findById(planId);
    const step = await PlanStep.findOne({ planId, index: stepIndex });
    if (!plan || !step) return { ok: false, error: "missing_plan_or_step" };

    if (plan.chain === "anvil") {
      return executeEvmStep(step.payload as Record<string, unknown>);
    }
    if (plan.chain === "solana-local") {
      return executeSolanaStep(step.payload as Record<string, unknown>);
    }
    return { ok: false, error: `unsupported_chain_${plan.chain}` } satisfies ExecResult;
  });
}
