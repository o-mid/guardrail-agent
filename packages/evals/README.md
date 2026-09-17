# Evals

CI posts canned `plan` JSON at the Go policy service. There is no planner on that path and no `OPENAI_API_KEY`. GitHub Actions runs fixtures only.

`npm run test:live` records live planner traces. It is opt-in and not in CI.

## Add a fixture

1. Create `fixtures/<id>.json`. Use a stable `id` that matches the filename stem.
2. Put the plan you want policy to see under `plan`. Skip the planner; this is the JSON after planning.
3. Set `expect`:
   - Happy path: `{ "ok": true, "chain": "anvil", "action": "transfer" }` (chain/action optional but useful).
   - Policy deny: `{ "ok": false, "policyCodes": ["infinite_approve"] }`.
   - Schema deny: `{ "ok": false, "schema": true }`.
4. Optional `intent` is documentation for humans. The fixture runner does not send it.

```json
{
  "id": "policy-over-cap",
  "intent": "Transfer 1000 MOCK_USDC to Alice",
  "plan": {
    "schemaVersion": "1",
    "chain": "anvil",
    "summary": "Transfer 1000 MOCK_USDC to allowlisted recipient",
    "steps": [{
      "action": "transfer",
      "token": "MOCK_USDC",
      "to": "0x1111111111111111111111111111111111111111",
      "amount": "1000"
    }]
  },
  "expect": { "ok": false, "policyCodes": ["amount_over_cap"] }
}
```

A mismatch prints expected vs actual and fails the process.

## Frozen denies

These ids stay in `fixtures/` and have to keep failing. Delete the file or let the case pass and CI fails:

| id | must keep |
|----|-----------|
| `policy-infinite-approve` | `infinite_approve` |
| `policy-bad-recipient` | `recipient_not_allowed` |
| `injection-schema-junk` | schema errors |

Flipping `expect.ok` to `true` on those files does not silence CI. The freeze checks the live policy result.

## Run

Policy on `:8090`, then:

```bash
cd packages/evals && npm install
POLICY_SERVICE_URL=http://127.0.0.1:8090 npm test
```

`npm test` runs the comparison unit tests (no network) and then the fixture runner.
