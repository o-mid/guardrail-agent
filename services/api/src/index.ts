import { createApp } from "./app.js";
import { config } from "./config.js";
import { ANVIL_CHAIN_ID, assertChainConfig, probeEvmChainId } from "./chains/allowlist.js";
import { connectDb } from "./db.js";
import { registerExecutors } from "./executors/index.js";
import { seedDemoIfNeeded } from "./scripts/seedBoot.js";

async function main() {
  assertChainConfig({
    evmRpcUrl: config.evmRpcUrl,
    solanaRpcUrl: config.solanaRpcUrl,
    evmChainId: config.siweChainId,
  });
  const probed = await probeEvmChainId(config.evmRpcUrl);
  if (probed.reachable && probed.chainId !== ANVIL_CHAIN_ID) {
    throw new Error(`EVM RPC reported chain id ${probed.chainId}`);
  }
  await connectDb();
  if (process.env.SEED_ON_BOOT === "1") {
    await seedDemoIfNeeded();
  }
  registerExecutors();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`api listening on ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
