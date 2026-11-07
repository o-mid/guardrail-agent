function positiveNumber(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function hostFromUri(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const siweUri = process.env.SIWE_URI ?? "http://localhost:3000";
const siweDomain = process.env.SIWE_DOMAIN ?? hostFromUri(siweUri);

/** Domains the client may put in a SIWE message (host[:port]). */
const siweDomains = Array.from(
  new Set([
    siweDomain,
    ...corsOrigins.map((o) => hostFromUri(o)),
  ]),
);

export const config = {
  port: Number(process.env.PORT ?? 8080),
  mongoUri: required(
    "MONGODB_URI",
    process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017/guardrail",
  ),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh"),
  policyServiceUrl: required("POLICY_SERVICE_URL", "http://127.0.0.1:8090"),
  vaultUrl: (process.env.VAULT_URL ?? "http://127.0.0.1:8100").replace(/\/$/, ""),
  vaultToken: required("VAULT_TOKEN", "local-vault-token"),
  evmRpcUrl: process.env.EVM_RPC_URL ?? "http://127.0.0.1:8545",
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  planner: (process.env.PLANNER ?? "mock") as "mock" | "openai" | "anthropic",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  arenaDailyUsdCap: Number(process.env.ARENA_DAILY_USD_CAP ?? "5"),
  arenaKillSwitch: ["1", "true", "yes"].includes((process.env.ARENA_KILL_SWITCH ?? "").toLowerCase()),
  arenaIpSalt: process.env.ARENA_IP_HASH_SALT ?? "arena-local-salt",
  arenaRateLimit: Number(process.env.ARENA_RATE_LIMIT ?? "10"),
  arenaRateWindowMs: Number(process.env.ARENA_RATE_WINDOW_MS ?? `${10 * 60 * 1000}`),
  arenaUsdPerMillionInput: positiveNumber(process.env.ARENA_USD_PER_MILLION_INPUT),
  arenaUsdPerMillionOutput: positiveNumber(process.env.ARENA_USD_PER_MILLION_OUTPUT),
  corsOrigins,
  siweDomain,
  siweUri,
  siweDomains,
  siweChainId: Number(process.env.SIWE_CHAIN_ID ?? 31337),
  accessTtlSec: 15 * 60,
  refreshTtlSec: 7 * 24 * 60 * 60,
};
