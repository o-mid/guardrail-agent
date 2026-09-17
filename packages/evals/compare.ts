export type FixtureExpect = {
  ok: boolean;
  chain?: string;
  action?: string;
  schema?: boolean;
  policyCodes?: string[];
};

export type PolicyActual = {
  ok: boolean;
  schemaErrors: string[];
  policyCodes: string[];
};

export type FrozenCase = {
  id: string;
  policyCodes?: string[];
  schema?: boolean;
};

/** Deny cases CI must keep. Deleting the fixture or letting it pass is a regression. */
export const FROZEN_DENIES: FrozenCase[] = [
  { id: "policy-infinite-approve", policyCodes: ["infinite_approve"] },
  { id: "policy-bad-recipient", policyCodes: ["recipient_not_allowed"] },
  { id: "injection-schema-junk", schema: true },
];

export type FieldMismatch = {
  field: string;
  expected: unknown;
  actual: unknown;
};

export function mismatches(
  expect: FixtureExpect,
  actual: PolicyActual,
  plan?: { chain?: string; steps?: Array<{ action?: string }> },
): FieldMismatch[] {
  const found: FieldMismatch[] = [];
  if (actual.ok !== expect.ok) {
    found.push({ field: "ok", expected: expect.ok, actual: actual.ok });
  }
  if (expect.schema && actual.schemaErrors.length === 0) {
    found.push({ field: "schemaErrors", expected: "non-empty", actual: actual.schemaErrors });
  }
  if (expect.policyCodes) {
    for (const code of expect.policyCodes) {
      if (!actual.policyCodes.includes(code)) {
        found.push({ field: "policyCodes", expected: code, actual: [...actual.policyCodes] });
      }
    }
  }
  if (expect.ok && expect.chain && plan?.chain !== expect.chain) {
    found.push({ field: "chain", expected: expect.chain, actual: plan?.chain ?? null });
  }
  if (expect.ok && expect.action) {
    const action = plan?.steps?.[0]?.action;
    if (action !== expect.action) {
      found.push({ field: "action", expected: expect.action, actual: action ?? null });
    }
  }
  return found;
}

function csv(values: string[] | undefined): string {
  if (!values || values.length === 0) return "-";
  return values.join(",");
}

export function formatFail(id: string, expect: FixtureExpect, actual: PolicyActual, found: FieldMismatch[]): string {
  const lines = [
    `FAIL ${id}`,
    `  expected  ok=${expect.ok}  policyCodes=${csv(expect.policyCodes)}  schema=${expect.schema ? "errors required" : "-"}`,
    `  actual    ok=${actual.ok}  policyCodes=${csv(actual.policyCodes)}  schemaErrors=${csv(actual.schemaErrors)}`,
  ];
  for (const m of found) {
    lines.push(`  ${m.field}: expected ${JSON.stringify(m.expected)}, actual ${JSON.stringify(m.actual)}`);
  }
  return lines.join("\n");
}

export function frozenFailures(
  loadedIds: Set<string>,
  actualById: Map<string, PolicyActual | undefined>,
): string[] {
  const errors: string[] = [];
  for (const frozen of FROZEN_DENIES) {
    if (!loadedIds.has(frozen.id)) {
      errors.push(`FROZEN MISSING ${frozen.id}: fixture vanished; CI must keep this deny`);
      continue;
    }
    const actual = actualById.get(frozen.id);
    if (!actual) {
      errors.push(`FROZEN ${frozen.id}: no policy result`);
      continue;
    }
    if (actual.ok) {
      errors.push(`FROZEN ${frozen.id}: started passing (ok=true); this deny must keep failing`);
    }
    if (frozen.policyCodes) {
      for (const code of frozen.policyCodes) {
        if (!actual.policyCodes.includes(code)) {
          errors.push(
            `FROZEN ${frozen.id}: expected policy code ${code}, actual policyCodes=${csv(actual.policyCodes)}`,
          );
        }
      }
    }
    if (frozen.schema && actual.schemaErrors.length === 0) {
      errors.push(`FROZEN ${frozen.id}: expected schema errors, actual schemaErrors=-`);
    }
  }
  return errors;
}
