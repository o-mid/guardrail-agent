import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { newJti, signAccessToken, signRefreshToken, verifyRefreshToken } from "../auth/tokens.js";
import { config } from "../config.js";
import { RefreshToken, User } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

authRouter.post("/auth/register", async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: "email_taken" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({ email, passwordHash });
  const tokens = await issuePair(user.id, user.email);
  res.status(201).json({ user: publicUser(user), ...tokens });
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }
  const tokens = await issuePair(user.id, user.email);
  res.json({ user: publicUser(user), ...tokens });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

async function issuePair(userId: string, email: string) {
  const jti = newJti();
  const expiresAt = new Date(Date.now() + config.refreshTtlSec * 1000);
  await RefreshToken.create({ jti, userId, expiresAt });
  return {
    accessToken: signAccessToken(userId, email),
    refreshToken: signRefreshToken(userId, jti),
  };
}

function publicUser(user: { id: string; email: string; evmAddress?: string | null; solanaPubkey?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    evmAddress: user.evmAddress ?? null,
    solanaPubkey: user.solanaPubkey ?? null,
  };
}

export { issuePair, publicUser };
