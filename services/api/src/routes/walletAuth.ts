import crypto from "node:crypto";
import { Router } from "express";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Wallet, verifyMessage } from "ethers";
import { SiweMessage } from "siwe";
import { z } from "zod";
import { config } from "../config.js";
import { SiweNonce, User } from "../models/index.js";
import { issuePair, publicUser } from "./auth.js";

export const walletAuthRouter = Router();

function siweParamsForOrigin(originHeader: string | undefined): {
  domain: string;
  uri: string;
  chainId: number;
} {
  const origin = originHeader?.trim();
  if (origin && config.corsOrigins.includes(origin)) {
    try {
      const u = new URL(origin);
      return { domain: u.host, uri: origin, chainId: config.siweChainId };
    } catch {
      // fall through
    }
  }
  return {
    domain: config.siweDomain,
    uri: config.siweUri,
    chainId: config.siweChainId,
  };
}

function siweErrorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as {
      message?: unknown;
      type?: unknown;
      error?: { type?: unknown; message?: unknown } | string;
    };
    if (typeof o.error === "object" && o.error) {
      const t = o.error.type ?? o.error.message;
      if (t != null && String(t)) return String(t);
    }
    if (typeof o.error === "string" && o.error) return o.error;
    if (o.type != null) return String(o.type);
    if (o.message != null) return String(o.message);
    try {
      return JSON.stringify(err);
    } catch {
      // ignore
    }
  }
  return "siwe_failed";
}

async function completeSiweLogin(message: string, signature: string) {
  const msg = new SiweMessage(message);
  if (!config.siweDomains.includes(msg.domain)) {
    return {
      ok: false as const,
      status: 401,
      error: "domain_mismatch",
      detail: `expected one of ${config.siweDomains.join(", ")}, got ${msg.domain}`,
    };
  }

  const nonceDoc = await SiweNonce.findOne({ nonce: msg.nonce });
  if (!nonceDoc || nonceDoc.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, status: 401, error: "invalid_nonce" };
  }

  let recovered: string;
  try {
    // Must verify the exact signed string — prepareMessage() would mint a new Issued At.
    recovered = verifyMessage(message, signature).toLowerCase();
  } catch (err) {
    return {
      ok: false as const,
      status: 401,
      error: "invalid_signature",
      detail: siweErrorDetail(err),
    };
  }

  if (recovered !== msg.address.toLowerCase()) {
    return {
      ok: false as const,
      status: 401,
      error: "invalid_signature",
      detail: `recovered ${recovered} != message ${msg.address.toLowerCase()}`,
    };
  }

  // Signature recovered via ethers against the exact message string.
  // Domain + nonce already checked; skip msg.verify() — some siwe versions
  // reject unknown VerifyParams keys and that was failing all wallet logins.

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
  return { ok: true as const, user, tokens };
}

walletAuthRouter.post("/auth/siwe/nonce", async (req, res) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  await SiweNonce.create({
    nonce,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  const params = siweParamsForOrigin(req.get("origin") ?? undefined);
  res.json({ nonce, ...params });
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
    const out = await completeSiweLogin(parsed.data.message, parsed.data.signature);
    if (!out.ok) {
      res.status(out.status).json({ error: out.error, detail: out.detail });
      return;
    }
    res.json({ user: publicUser(out.user), ...out.tokens });
  } catch (err) {
    console.error("siwe_verify", err);
    res.status(401).json({ error: "siwe_failed", detail: siweErrorDetail(err) });
  }
});

/**
 * Local demo helper: sign SIWE with the configured Anvil demo key (no browser wallet).
 * Disabled unless EVM_DEMO_PRIVATE_KEY is set.
 */
walletAuthRouter.post("/auth/siwe/demo", async (req, res) => {
  if (!config.evmDemoPrivateKey) {
    res.status(404).json({ error: "demo_siwe_disabled" });
    return;
  }
  try {
    const wallet = new Wallet(config.evmDemoPrivateKey);
    const params = siweParamsForOrigin(req.get("origin") ?? undefined);
    const nonce = crypto.randomBytes(16).toString("hex");
    await SiweNonce.create({
      nonce,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const msg = new SiweMessage({
      domain: params.domain,
      address: wallet.address,
      statement: "Sign in to Guardrail Agent",
      uri: params.uri,
      version: "1",
      chainId: params.chainId,
      nonce,
    });
    const message = msg.prepareMessage();
    const signature = await wallet.signMessage(message);
    const out = await completeSiweLogin(message, signature);
    if (!out.ok) {
      res.status(out.status).json({ error: out.error, detail: out.detail });
      return;
    }
    res.json({ user: publicUser(out.user), ...out.tokens });
  } catch (err) {
    console.error("siwe_demo", err);
    res.status(401).json({ error: "siwe_failed", detail: siweErrorDetail(err) });
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
