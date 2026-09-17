import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FROZEN_DENIES, formatFail, frozenFailures, mismatches } from "./compare.ts";

describe("eval expected vs actual", () => {
  it("is silent when a deny matches", () => {
    const found = mismatches(
      { ok: false, policyCodes: ["infinite_approve"] },
      { ok: false, policyCodes: ["infinite_approve"], schemaErrors: [] },
    );
    assert.deepEqual(found, []);
  });

  it("names expected vs actual when ok flips", () => {
    const expect = { ok: false, policyCodes: ["infinite_approve"] };
    const actual = { ok: true, policyCodes: [] as string[], schemaErrors: [] as string[] };
    const found = mismatches(expect, actual);
    assert.equal(found.length > 0, true);
    const text = formatFail("policy-infinite-approve", expect, actual, found);
    assert.match(text, /expected {2}ok=false/);
    assert.match(text, /actual {4}ok=true/);
    assert.match(text, /ok: expected false, actual true/);
  });
});

describe("frozen deny contract", () => {
  it("lists infinite_approve, recipient_not_allowed, and schema injection", () => {
    const ids = FROZEN_DENIES.map((c) => c.id);
    assert.deepEqual(ids, ["policy-infinite-approve", "policy-bad-recipient", "injection-schema-junk"]);
    assert.ok(FROZEN_DENIES.some((c) => c.policyCodes?.includes("infinite_approve")));
    assert.ok(FROZEN_DENIES.some((c) => c.policyCodes?.includes("recipient_not_allowed")));
    assert.ok(FROZEN_DENIES.some((c) => c.schema === true));
  });

  it("fails if a frozen fixture vanishes", () => {
    const errors = frozenFailures(new Set(["policy-infinite-approve"]), new Map());
    assert.ok(errors.some((e) => e.includes("FROZEN MISSING policy-bad-recipient")));
    assert.ok(errors.some((e) => e.includes("FROZEN MISSING injection-schema-junk")));
  });

  it("fails if a frozen deny starts passing", () => {
    const ids = new Set(FROZEN_DENIES.map((c) => c.id));
    const actual = new Map([
      ["policy-infinite-approve", { ok: true, policyCodes: [], schemaErrors: [] }],
      ["policy-bad-recipient", { ok: false, policyCodes: ["recipient_not_allowed"], schemaErrors: [] }],
      ["injection-schema-junk", { ok: false, policyCodes: [], schemaErrors: ["additionalProperties"] }],
    ]);
    const errors = frozenFailures(ids, actual);
    assert.ok(errors.some((e) => e.includes("policy-infinite-approve") && e.includes("started passing")));
  });
});
