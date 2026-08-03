import { hashPassword } from "../auth/password.js";
import { Policy, User } from "../models/index.js";
import { defaultRules } from "../policy/client.js";

/** Idempotent seed for hosted demos (SEED_ON_BOOT=1). */
export async function seedDemoIfNeeded(): Promise<void> {
  const email = "demo@guardrail.local";
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      email,
      passwordHash: await hashPassword("demopass123"),
      evmAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      solanaPubkey: null,
    });
    console.log("seed: created demo user", email);
  }

  const global = await Policy.findOne({ scope: "global" }).sort({ version: -1 });
  if (!global) {
    await Policy.create({ scope: "global", version: 1, rules: defaultRules });
    console.log("seed: global policy v1");
  }
}
