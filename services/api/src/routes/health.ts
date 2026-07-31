import { Router } from "express";
import { config } from "../config.js";
import { dbReady } from "../db.js";
import { vaultHealthy } from "../vault/client.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const mongo = await dbReady();
  let policy = false;
  try {
    const r = await fetch(`${config.policyServiceUrl}/healthz`, { signal: AbortSignal.timeout(1500) });
    policy = r.ok;
  } catch {
    policy = false;
  }
  const vault = await vaultHealthy();

  const ok = mongo;
  res.status(ok ? 200 : 503).json({
    ok,
    mongo,
    policy,
    vault,
    planner: config.planner,
    evmRpc: config.evmRpcUrl,
    solanaRpc: config.solanaRpcUrl,
  });
});
