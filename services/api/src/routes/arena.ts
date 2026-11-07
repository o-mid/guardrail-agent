import { Router } from "express";
import { config } from "../config.js";
import { createPlanner } from "../planner/index.js";
import { defaultRules, validatePlan } from "../policy/client.js";
import { SURFACES, TEXT_MAX, type Surface } from "../arena/examples.js";
import { allowRequest, hashIp } from "../arena/limit.js";
import { broadcastAllowedPlan } from "../arena/broadcast.js";
import { createState, publicStatus, runAttempt, type ArenaEnv } from "../arena/run.js";

const state = createState();

function envFromConfig(): ArenaEnv {
  const mode = config.planner;
  return {
    killSwitch: config.arenaKillSwitch,
    plannerMode: mode === "openai" || mode === "anthropic" ? mode : "mock",
    dailyCapUsd: config.arenaDailyUsdCap,
    usdPerMillionInput: config.arenaUsdPerMillionInput,
    usdPerMillionOutput: config.arenaUsdPerMillionOutput,
  };
}

export const arenaRouter = Router();

arenaRouter.get("/arena/status", (_req, res) => {
  res.json(publicStatus(state, envFromConfig()));
});

arenaRouter.post("/arena/attempt", async (req, res) => {
  const hash = hashIp(req.ip || "unknown", config.arenaIpSalt);
  if (!allowRequest(hash, Date.now(), config.arenaRateLimit, config.arenaRateWindowMs)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  const surface = req.body?.surface;
  const text = req.body?.text;
  if (typeof surface !== "string" || typeof text !== "string") {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  if (!SURFACES.includes(surface as Surface)) {
    res.status(400).json({ error: "bad_surface" });
    return;
  }
  if (text.length > TEXT_MAX) {
    res.status(400).json({ error: "text_too_long", max: TEXT_MAX });
    return;
  }
  if (text.trim().length === 0) {
    res.status(400).json({ error: "empty_text" });
    return;
  }
  try {
    const result = await runAttempt(
      { surface: surface as Surface, text, agentHash: hash },
      {
        now: () => Date.now(),
        planner: () => createPlanner(),
        validate: (plan, context) => validatePlan(plan, { version: 1, rules: defaultRules }, context),
        broadcast: broadcastAllowedPlan,
        state,
        env: envFromConfig(),
      },
    );
    res.json(result);
  } catch {
    console.error("arena_failed");
    res.status(500).json({ error: "arena_failed" });
  }
});
