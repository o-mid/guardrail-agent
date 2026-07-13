import { Router } from "express";
import { z } from "zod";
import { User } from "../models/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { publicUser } from "./auth.js";

export const walletsRouter = Router();

const linkSchema = z
  .object({
    evmAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    solanaPubkey: z.string().min(32).max(64).optional(),
  })
  .refine((v) => v.evmAddress || v.solanaPubkey, { message: "need address" });

walletsRouter.post("/wallets/link", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const user = await User.findById(req.userId);
  if (!user) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (parsed.data.evmAddress) user.evmAddress = parsed.data.evmAddress;
  if (parsed.data.solanaPubkey) user.solanaPubkey = parsed.data.solanaPubkey;
  await user.save();
  res.json({ user: publicUser(user) });
});
