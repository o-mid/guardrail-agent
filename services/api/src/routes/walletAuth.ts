import crypto from "node:crypto";
import { Router } from "express";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { config } from "../config.js";
import { SiweNonce, User } from "../models/index.js";
import { issuePair, publicUser } from "./auth.js";

export const walletAuthRouter = Router();

walletAuthRouter.post("/auth/siwe/nonce", async (_req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  await SiweNonce.create({
    nonce,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  res.json({ nonce });
});

walletAuthRouter.post("/auth/siwe/verify", async (req, res) => {
  const parsed = z
    .object({
      message: z.string().min(1),
      signature: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  try {
    const msg = new SiweMessage(parsed.data.message);
    const nonceDoc = await SiweNonce.findOne({ nonce: msg.nonce });
    if (!nonceDoc || nonceDoc.expiresAt.getTime() < Date.now()) {
      res.status(401).json({ error: "invalid_nonce" });
      return;
    }
    const result = await msg.verify({ signature: parsed.data.signature, domain: config.siweDomain });
    if (!result.success) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    await SiweNonce.deleteOne({ nonce: msg.nonce });
    const address = msg.address.toLowerCase();
    let user = await User.findOne({ evmAddress: address });
    if (!user) {
      user = await User.create({
        email: `${address}@siwe.local`,
        passwordHash: await dummyHash(),
        evmAddress: address,
      });
    }
    const tokens = await issuePair(user.id, user.email);
    res.json({ user: publicUser(user), ...tokens });
  } catch {
    res.status(401).json({ error: "siwe_failed" });
  }
});

walletAuthRouter.post("/auth/solana/verify", async (req, res) => {
  const parsed = z
    .object({
      pubkey: z.string().min(32),
      message: z.string().min(1),
      signature: z.string().min(1),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }
  try {
    const pubkeyBytes = bs58.decode(parsed.data.pubkey);
    const sigBytes = bs58.decode(parsed.data.signature);
    const msgBytes = new TextEncoder().encode(parsed.data.message);
    const ok = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!ok) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }
    if (!parsed.data.message.includes(parsed.data.pubkey)) {
      res.status(401).json({ error: "message_mismatch" });
      return;
    }
    let user = await User.findOne({ solanaPubkey: parsed.data.pubkey });
    if (!user) {
      user = await User.create({
        email: `${parsed.data.pubkey.slice(0, 16)}@sol.local`,
        passwordHash: await dummyHash(),
        solanaPubkey: parsed.data.pubkey,
      });
    }
    const tokens = await issuePair(user.id, user.email);
    res.json({ user: publicUser(user), ...tokens });
  } catch {
    res.status(401).json({ error: "solana_auth_failed" });
  }
});

async function dummyHash() {
  const { hashPassword } = await import("../auth/password.js");
  return hashPassword(crypto.randomBytes(24).toString("hex"));
}
