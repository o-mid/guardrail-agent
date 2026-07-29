import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { config } from "../config.js";
import { loadAnvilDeployment } from "./deployments.js";
import type { ExecResult } from "../services/execution.js";

const erc20Abi = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
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
  if (action !== "transfer") {
    return { ok: false, error: `unsupported_action_${action}` };
  }

  try {
    const w = wallet();
    const dep = loadAnvilDeployment();
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
  } catch (err) {
    return { ok: false, dryRunOk: false, error: err instanceof Error ? err.message : String(err) };
  }
}
