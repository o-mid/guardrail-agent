import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
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

function wallet() {
  if (!config.evmDemoPrivateKey) {
    throw new Error("EVM_DEMO_PRIVATE_KEY missing");
  }
  const provider = new JsonRpcProvider(config.evmRpcUrl);
  return new Wallet(config.evmDemoPrivateKey, provider);
}

export async function executeEvmStep(payload: Record<string, unknown>): Promise<ExecResult> {
  const action = String(payload.action);
  const w = wallet();
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
      const tx = await c.transfer(to, amount);
      const receipt = await tx.wait();
      return { ok: true, dryRunOk: true, txHash: receipt?.hash ?? tx.hash };
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
      const tx = await c.approve(spender, amount);
      const receipt = await tx.wait();
      return { ok: true, dryRunOk: true, txHash: receipt?.hash ?? tx.hash };
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
      const approveTx = await token.approve(dep.MockSwapRouter, amountIn);
      await approveTx.wait();
      const router = new Contract(dep.MockSwapRouter, routerAbi, w);
      await router.swapExactIn.staticCall(inAddr, outAddr, amountIn, minOut);
      const tx = await router.swapExactIn(inAddr, outAddr, amountIn, minOut);
      const receipt = await tx.wait();
      return { ok: true, dryRunOk: true, txHash: receipt?.hash ?? tx.hash };
    }

    return { ok: false, error: `unsupported_action_${action}` };
  } catch (err) {
    return { ok: false, dryRunOk: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function resolveSpender(spender: string, dep: ReturnType<typeof loadAnvilDeployment>): string {
  if (spender === "MockSwapRouter" || spender.toLowerCase() === "router") return dep.MockSwapRouter;
  return spender;
}
