import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import { registerExecutors } from "./executors/index.js";
import { seedDemoIfNeeded } from "./scripts/seedBoot.js";

async function main() {
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
