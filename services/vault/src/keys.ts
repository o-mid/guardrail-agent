import { Wallet } from "ethers";
import { Keypair } from "@solana/web3.js";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** Anvil account #0 — local demo only. */
const DEFAULT_EVM =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function loadSolanaKeypair(): Keypair {
  const raw = process.env.SOLANA_DEMO_SECRET_KEY?.trim();
  if (raw) {
    const arr = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  // Same deterministic seed the API used before the vault split.
  const seed = new Uint8Array(32);
  seed[0] = 7;
  return Keypair.fromSeed(seed);
}

export const vaultKeys = {
  token: required("VAULT_TOKEN", "local-vault-token"),
  port: Number(process.env.PORT ?? 8100),
  evmWallet: new Wallet(required("EVM_DEMO_PRIVATE_KEY", DEFAULT_EVM)),
  solana: loadSolanaKeypair(),
};
