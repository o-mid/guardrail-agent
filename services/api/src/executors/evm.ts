import { Contract, JsonRpcProvider, Wallet, parseUnits, type TransactionRequest } from "ethers";
import { config } from "../config.js";
import { loadAnvilDeployment } from "./deployments.js";
import type { ExecResult } from "../services/execution.js";

const erc20Abi = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

const routerAbi = [
  "function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)",
];

let provider: JsonRpcProvider | null = null;
let signer: Wallet | null = null;
let chain: Promise<void> = Promise.resolve();

function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(config.evmRpcUrl, undefined, {
      staticNetwork: true,
      batchMaxCount: 1,
    });
  }
  return provider;
}

function getWallet(): Wallet {
  if (!config.evmDemoPrivateKey) {
    throw new Error("EVM_DEMO_PRIVATE_KEY missing");
  }
  if (!signer) {
    signer = new Wallet(config.evmDemoPrivateKey, getProvider());
  }
  return signer;
}

/** Serialize all demo-wallet sends so Anvil nonces cannot race. */
function withEvmLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isNonceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /nonce too low|NONCE_EXPIRED|nonce has already been used|replacement transaction underpriced/i.test(
    msg,
  );
}

/**
 * ethers JsonRpcProvider caches eth_getTransactionCount. After tx.wait() the
 * cache can still return the pre-tx nonce ("nonce too low" on the next send).
 * Read pending count via raw RPC instead.
 */
async function pendingNonce(address: string): Promise<number> {
  const hex: string = await getProvider().send("eth_getTransactionCount", [address, "pending"]);
  return Number.parseInt(hex, 16);
}

async function sendContractTx(
  send: (overrides: TransactionRequest) => Promise<{ hash: string; wait: () => Promise<{ hash?: string } | null> }>,
): Promise<string> {
  const w = getWallet();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const nonce = await pendingNonce(w.address);
      const tx = await send({ nonce });
      const receipt = await tx.wait();
      return receipt?.hash ?? tx.hash;
    } catch (err) {
      lastErr = err;
      if (!isNonceError(err) || attempt === 2) throw err;
      provider = null;
      signer = null;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function executeEvmStep(payload: Record<string, unknown>): Promise<ExecResult> {
  return withEvmLock(async () => {
    const action = String(payload.action);
    const w = getWallet();
    const dep = loadAnvilDeployment();

    try {
      if (action === "transfer") {
        const token = String(payload.token);
        const to = String(payload.to);
        const amount = parseUnits(String(payload.amount), 18);
        const addr = dep.tokens[token];
        if (!addr) return { ok: false, error: `unknown_token_${token}` };
        const c = new Contract(addr, erc20Abi, w);
        await c.transfer.staticCall(to, amount);
        const txHash = await sendContractTx((overrides) => c.transfer(to, amount, overrides));
        return { ok: true, dryRunOk: true, txHash };
      }

      if (action === "approve") {
        const token = String(payload.token);
        const spender = resolveSpender(String(payload.spender), dep);
        const amountStr = String(payload.amount);
        if (amountStr === "unlimited" || amountStr === "max" || amountStr === "infinite") {
          return { ok: false, error: "infinite_approve_blocked_at_executor" };
        }
        const amount = parseUnits(amountStr, 18);
        const addr = dep.tokens[token];
        if (!addr) return { ok: false, error: `unknown_token_${token}` };
        const c = new Contract(addr, erc20Abi, w);
        await c.approve.staticCall(spender, amount);
        const txHash = await sendContractTx((overrides) => c.approve(spender, amount, overrides));
        return { ok: true, dryRunOk: true, txHash };
      }

      if (action === "swap") {
        const tokenIn = String(payload.tokenIn);
        const tokenOut = String(payload.tokenOut);
        const amountIn = parseUnits(String(payload.amountIn), 18);
        const minOut = parseUnits(String(payload.minAmountOut), 18);
        const inAddr = dep.tokens[tokenIn];
        const outAddr = dep.tokens[tokenOut];
        if (!inAddr || !outAddr) return { ok: false, error: "unknown_swap_token" };

        const token = new Contract(inAddr, erc20Abi, w);
        await token.approve.staticCall(dep.MockSwapRouter, amountIn);
        await sendContractTx((overrides) => token.approve(dep.MockSwapRouter, amountIn, overrides));

        const router = new Contract(dep.MockSwapRouter, routerAbi, w);
        await router.swapExactIn.staticCall(inAddr, outAddr, amountIn, minOut);
        const txHash = await sendContractTx((overrides) =>
          router.swapExactIn(inAddr, outAddr, amountIn, minOut, overrides),
        );
        return { ok: true, dryRunOk: true, txHash };
      }

      return { ok: false, error: `unsupported_action_${action}` };
    } catch (err) {
      return { ok: false, dryRunOk: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

function resolveSpender(spender: string, dep: ReturnType<typeof loadAnvilDeployment>): string {
  if (spender === "MockSwapRouter" || spender.toLowerCase() === "router") return dep.MockSwapRouter;
  return spender;
}
