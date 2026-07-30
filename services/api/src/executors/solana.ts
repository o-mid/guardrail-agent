import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { config } from "../config.js";
import type { ExecResult } from "../services/execution.js";

function loadKeypair(): Keypair {
  if (!config.solanaDemoKeypairPath) {
    const seed = new Uint8Array(32);
    seed[0] = 7;
    return Keypair.fromSeed(seed);
  }
  const raw = JSON.parse(readFileSync(config.solanaDemoKeypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export async function executeSolanaStep(payload: Record<string, unknown>): Promise<ExecResult> {
  const action = String(payload.action);
  if (action !== "transfer") {
    return { ok: false, error: `unsupported_action_${action}` };
  }
  const mint = String(payload.mint);
  if (mint !== "SOL") {
    return { ok: false, error: "only_native_sol_in_mvp" };
  }

  try {
    const connection = new Connection(config.solanaRpcUrl, "confirmed");
    const payer = loadKeypair();
    const to = new PublicKey(String(payload.to));
    const amountSol = Number(payload.amount);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      return { ok: false, error: "bad_amount" };
    }
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: to,
        lamports,
      }),
    );
    tx.sign(payer);

    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      return { ok: false, dryRunOk: false, error: JSON.stringify(sim.value.err) };
    }

    const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
    return { ok: true, dryRunOk: true, txHash: sig };
  } catch (err) {
    return { ok: false, dryRunOk: false, error: err instanceof Error ? err.message : String(err) };
  }
}
