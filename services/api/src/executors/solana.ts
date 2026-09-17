import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { config } from "../config.js";
import { vaultIdentity, vaultSignSolanaTx } from "../vault/client.js";
import { vaultPolicyGate, type ExecResult, type StoredPlanForPolicy } from "../services/execution.js";

export async function executeSolanaStep(
  payload: Record<string, unknown>,
  stored: StoredPlanForPolicy,
): Promise<ExecResult> {
  const action = String(payload.action);
  if (action !== "transfer") {
    return { ok: false, error: `unsupported_action_${action}` };
  }
  const mint = String(payload.mint);
  if (mint !== "SOL") {
    return { ok: false, error: "only_native_sol_in_mvp" };
  }

  try {
    const blockedEarly = await vaultPolicyGate(stored);
    if (blockedEarly) return blockedEarly;

    const connection = new Connection(config.solanaRpcUrl, "confirmed");
    const { solanaPubkey } = await vaultIdentity();
    const from = new PublicKey(solanaPubkey);
    const to = new PublicKey(String(payload.to));
    const amountSol = Number(payload.amount);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      return { ok: false, error: "bad_amount" };
    }
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: from,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports,
      }),
    );

    const unsigned = Buffer.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    ).toString("base64");
    const blocked = await vaultPolicyGate(stored);
    if (blocked) return blocked;
    const signed = await vaultSignSolanaTx(unsigned);
    const signedTx = Transaction.from(Buffer.from(signed.transaction, "base64"));

    const sim = await connection.simulateTransaction(signedTx);
    if (sim.value.err) {
      return { ok: false, dryRunOk: false, error: JSON.stringify(sim.value.err) };
    }

    const sig = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    return { ok: true, dryRunOk: true, txHash: sig };
  } catch (err) {
    return { ok: false, dryRunOk: false, error: err instanceof Error ? err.message : String(err) };
  }
}
