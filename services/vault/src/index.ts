import express from "express";
import { Transaction, type TransactionLike } from "ethers";
import { Transaction as SolTx } from "@solana/web3.js";
import { vaultKeys } from "./keys.js";

/**
 * Demo key vault: holds chain keys and signs on request.
 * Not threshold MPC / HSM — production analog is Fireblocks-style MPC.
 * Keys must not be mounted into the Express API process.
 */
const app = express();
app.use(express.json({ limit: "256kb" }));

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token !== vaultKeys.token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    role: "demo-key-vault",
    evmAddress: vaultKeys.evmWallet.address,
    solanaPubkey: vaultKeys.solana.publicKey.toBase58(),
  });
});

app.get("/v1/identity", auth, (_req, res) => {
  res.json({
    evmAddress: vaultKeys.evmWallet.address,
    solanaPubkey: vaultKeys.solana.publicKey.toBase58(),
  });
});

app.post("/v1/evm/sign-message", auth, async (req, res) => {
  const message = req.body?.message;
  if (typeof message !== "string" || !message) {
    res.status(400).json({ error: "message_required" });
    return;
  }
  try {
    const signature = await vaultKeys.evmWallet.signMessage(message);
    res.json({ signature, address: vaultKeys.evmWallet.address });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/v1/evm/sign-transaction", auth, async (req, res) => {
  const tx = req.body?.transaction as TransactionLike | undefined;
  if (!tx || typeof tx !== "object") {
    res.status(400).json({ error: "transaction_required" });
    return;
  }
  try {
    const signed = await vaultKeys.evmWallet.signTransaction(tx);
    const parsed = Transaction.from(signed);
    res.json({
      rawTransaction: signed,
      hash: parsed.hash,
      from: vaultKeys.evmWallet.address,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/v1/solana/sign-transaction", auth, async (req, res) => {
  const b64 = req.body?.transaction;
  if (typeof b64 !== "string" || !b64) {
    res.status(400).json({ error: "transaction_required" });
    return;
  }
  try {
    const tx = SolTx.from(Buffer.from(b64, "base64"));
    tx.partialSign(vaultKeys.solana);
    res.json({
      transaction: Buffer.from(tx.serialize()).toString("base64"),
      pubkey: vaultKeys.solana.publicKey.toBase58(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(vaultKeys.port, () => {
  console.log(
    `vault listening :${vaultKeys.port} evm=${vaultKeys.evmWallet.address} sol=${vaultKeys.solana.publicKey.toBase58()}`,
  );
});
