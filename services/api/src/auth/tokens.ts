import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type AccessClaims = {
  sub: string;
  email: string;
  typ: "access";
};

export type RefreshClaims = {
  sub: string;
  jti: string;
  typ: "refresh";
};

export function signAccessToken(userId: string, email: string): string {
  const claims: AccessClaims = { sub: userId, email, typ: "access" };
  return jwt.sign(claims, config.jwtAccessSecret, { expiresIn: config.accessTtlSec });
}

export function signRefreshToken(userId: string, jti: string): string {
  const claims: RefreshClaims = { sub: userId, jti, typ: "refresh" };
  return jwt.sign(claims, config.jwtRefreshSecret, { expiresIn: config.refreshTtlSec });
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, config.jwtAccessSecret) as AccessClaims;
  if (decoded.typ !== "access") throw new Error("invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const decoded = jwt.verify(token, config.jwtRefreshSecret) as RefreshClaims;
  if (decoded.typ !== "refresh") throw new Error("invalid token type");
  return decoded;
}

export function newJti(): string {
  return crypto.randomUUID();
}
