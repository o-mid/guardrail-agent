import type { ExecResult } from "../services/execution.js";

// placeholder until solana commit wires web3.js
export async function executeSolanaStep(_payload: Record<string, unknown>): Promise<ExecResult> {
  return { ok: false, error: "solana_executor_not_ready" };
}
