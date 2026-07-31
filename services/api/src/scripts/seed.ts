import { connectDb } from "../db.js";
import { hashPassword } from "../auth/password.js";
import { Policy, User } from "../models/index.js";
import { defaultRules } from "../policy/client.js";

async function main() {
  await connectDb();
  const email = "demo@guardrail.local";
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      passwordHash: await hashPassword("demopass123"),
      evmAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      solanaPubkey: null,
    });
    console.log("created demo user", email, "password demopass123");
  } else {
    console.log("demo user exists", email);
  }

  const global = await Policy.findOne({ scope: "global" }).sort({ version: -1 });
  if (!global) {
    await Policy.create({ scope: "global", version: 1, rules: defaultRules });
    console.log("seeded global policy v1");
  } else {
    console.log("global policy already present v", global.version);
  }

  console.log("chips:");
  for (const c of [
    "Send 5 MOCK_USDC to Alice",
    "Swap 10 MOCK_USDC for MOCK_ETH",
    "Approve unlimited MOCK_USDC for 0xEvil",
    "Send 0.1 SOL to Bob",
    "Transfer 1000 MOCK_USDC to Alice",
  ]) {
    console.log(" -", c);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
