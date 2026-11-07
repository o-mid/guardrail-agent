import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FROZEN_ATTACKS, attackMismatches } from "./attack-compare.ts";

describe("attack firewall contract", () => {
  it("fails when a weakened rule lets the attack through", () => {
    const found = attackMismatches(
      { modelResisted: false, firewallHeld: true, policyCodes: ["recipient_swap"] },
      { ok: true, policyCodes: [], schemaErrors: [] },
    );
    assert.ok(found.some((item) => item.field === "firewallHeld" || item.field === "ok"));
    assert.ok(found.some((item) => item.field === "policyCodes" && item.expected === "recipient_swap"));
  });

  it("passes when the standing task is allowed", () => {
    const found = attackMismatches(
      { modelResisted: true, firewallHeld: true },
      { ok: true, policyCodes: [], schemaErrors: [] },
    );
    assert.deepEqual(found, []);
  });

  it("keeps the attack ids that CI must not lose", () => {
    assert.ok(FROZEN_ATTACKS.includes("recipient-swap"));
    assert.ok(FROZEN_ATTACKS.includes("spend-window"));
    assert.ok(FROZEN_ATTACKS.includes("memo-smuggle"));
  });
});
