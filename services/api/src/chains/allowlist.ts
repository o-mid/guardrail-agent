export const ANVIL_CHAIN_ID = 31337;

const EVM_RPC_ALLOWLIST = new Set([
  "http://127.0.0.1:8545",
  "http://localhost:8545",
  "http://anvil:8545",
]);

const SOLANA_RPC_ALLOWLIST = new Set([
  "http://127.0.0.1:8899",
  "http://localhost:8899",
  "http://solana:8899",
]);

export function normalizeRpc(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("RPC URL is not a valid URL");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`RPC host ${url.host} must not include credentials or a query`);
  }
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

export function assertChainConfig(input: {
  evmRpcUrl: string;
  solanaRpcUrl: string;
  evmChainId: number;
}): void {
  const evm = normalizeRpc(input.evmRpcUrl);
  const solana = normalizeRpc(input.solanaRpcUrl);
  if (!EVM_RPC_ALLOWLIST.has(evm)) {
    throw new Error(`EVM RPC host ${safeHost(input.evmRpcUrl)} is not local Anvil`);
  }
  if (!SOLANA_RPC_ALLOWLIST.has(solana)) {
    throw new Error(`Solana RPC host ${safeHost(input.solanaRpcUrl)} is not solana-test-validator`);
  }
  if (input.evmChainId !== ANVIL_CHAIN_ID) {
    throw new Error(`EVM chain id ${input.evmChainId} is not 31337`);
  }
}

export function chainIdFromHex(hex: string): number {
  return Number.parseInt(hex, 16);
}

export async function probeEvmChainId(
  rpcUrl: string,
  timeoutMs = 800,
): Promise<{ reachable: boolean; chainId?: number }> {
  assertChainConfig({ evmRpcUrl: rpcUrl, solanaRpcUrl: "http://127.0.0.1:8899", evmChainId: ANVIL_CHAIN_ID });
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { reachable: false };
    const body = (await res.json()) as { result?: string };
    if (typeof body.result !== "string") return { reachable: false };
    const chainId = chainIdFromHex(body.result);
    if (!Number.isFinite(chainId)) return { reachable: false };
    return { reachable: true, chainId };
  } catch {
    return { reachable: false };
  }
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return "invalid";
  }
}
