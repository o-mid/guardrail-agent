import { config } from "../config.js";
import { executeEvmStep } from "../executors/evm.js";
import { executeSolanaStep } from "../executors/solana.js";
import type { PlanV1 } from "../planner/types.js";
import type { StoredPlanForPolicy } from "../services/execution.js";
import { ANVIL_CHAIN_ID, assertChainConfig, probeEvmChainId } from "../chains/allowlist.js";

export async function broadcastAllowedPlan(plan: PlanV1): Promise<{ txHash?: string; error?: string }> {
  assertChainConfig({
    evmRpcUrl: config.evmRpcUrl,
    solanaRpcUrl: config.solanaRpcUrl,
    evmChainId: config.siweChainId,
  });
  const stored: StoredPlanForPolicy = {
    userId: "arena",
    schemaVersion: plan.schemaVersion,
    chain: plan.chain,
    summary: "arena",
    steps: plan.steps.map((payload, index) => ({ index, payload })),
  };
  const step = plan.steps[0];
  if (!step) return { error: "no_step" };
  if (plan.chain === "anvil") {
    const probed = await probeEvmChainId(config.evmRpcUrl);
    if (!probed.reachable) return { error: "anvil_unreachable" };
    if (probed.chainId !== ANVIL_CHAIN_ID) return { error: "refused_chain_id" };
    const result = await executeEvmStep(step, stored);
    return result.ok ? { txHash: result.txHash } : { error: result.error ?? "broadcast_failed" };
  }
  if (plan.chain === "solana-local") {
    const result = await executeSolanaStep(step, stored);
    return result.ok ? { txHash: result.txHash } : { error: result.error ?? "broadcast_failed" };
  }
  return { error: "refused_chain" };
}
