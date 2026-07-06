function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/guardrail"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh"),
  policyServiceUrl: required("POLICY_SERVICE_URL", "http://127.0.0.1:8090"),
  evmRpcUrl: process.env.EVM_RPC_URL ?? "http://127.0.0.1:8545",
  evmDemoPrivateKey: process.env.EVM_DEMO_PRIVATE_KEY ?? "",
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  solanaDemoKeypairPath: process.env.SOLANA_DEMO_KEYPAIR_PATH ?? "",
  planner: (process.env.PLANNER ?? "mock") as "mock" | "openai",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  siweDomain: process.env.SIWE_DOMAIN ?? "localhost",
  siweUri: process.env.SIWE_URI ?? "http://localhost:3000",
  accessTtlSec: 15 * 60,
  refreshTtlSec: 7 * 24 * 60 * 60,
};
