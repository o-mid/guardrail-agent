import { Router } from "express";
import { config } from "../config.js";
import { dbReady } from "../db.js";

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

  const ok = mongo;
  res.status(ok ? 200 : 503).json({
    ok,
    mongo,
    policy,
    planner: config.planner,
    evmRpc: config.evmRpcUrl,
    solanaRpc: config.solanaRpcUrl,
  });
});
