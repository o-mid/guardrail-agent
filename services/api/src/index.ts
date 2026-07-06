import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDb } from "./db.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`api listening on ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
