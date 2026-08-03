import { config } from "../config.js";

type Identity = { evmAddress: string; solanaPubkey: string };

/** Minimal unsigned EVM tx payload for the demo vault. */
export type VaultEvmTx = {
  to: string;
  data?: string;
  value?: string | number | bigint;
  nonce: number;
  chainId: number;
  type?: number;
  gasLimit?: string | number | bigint;
  maxFeePerGas?: string | number | bigint;
  maxPriorityFeePerGas?: string | number | bigint;
};

async function vaultFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!config.vaultUrl) {
    throw new Error("VAULT_URL missing — demo keys live in services/vault only");
  }
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${config.vaultToken}`);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${config.vaultUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `vault_${res.status}`);
  }
  return body;
}

let cachedIdentity: Identity | null = null;

export async function vaultIdentity(): Promise<Identity> {
  if (cachedIdentity) return cachedIdentity;
  cachedIdentity = await vaultFetch<Identity>("/v1/identity");
  return cachedIdentity;
}

export async function vaultSignEvmMessage(message: string): Promise<{ signature: string; address: string }> {
  return vaultFetch("/v1/evm/sign-message", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

export async function vaultSignEvmTx(transaction: VaultEvmTx): Promise<{
  rawTransaction: string;
  hash: string | null;
  from: string;
}> {
  return vaultFetch("/v1/evm/sign-transaction", {
    method: "POST",
    body: JSON.stringify({ transaction: jsonSafe(transaction) }),
  });
}

export async function vaultSignSolanaTx(transactionBase64: string): Promise<{
  transaction: string;
  pubkey: string;
}> {
  return vaultFetch("/v1/solana/sign-transaction", {
    method: "POST",
    body: JSON.stringify({ transaction: transactionBase64 }),
  });
}

export async function vaultHealthy(): Promise<boolean> {
  if (!config.vaultUrl) return false;
  try {
    const r = await fetch(`${config.vaultUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}
