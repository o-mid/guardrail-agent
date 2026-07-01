# Guardrail Agent

Natural-language chain intent to a schema-checked plan, Go policy gate, human approval, then dry-run and execute on local EVM and Solana.

Local mocks and test validators only by default. No custodial keys. Mainnet is off unless you flip explicit env flags.

## Layout

- `apps/web` — Next.js UI
- `services/api` — Express API, planners, executors
- `services/policy` — Go schema + policy checks
- `packages/plan-schema` — shared plan schema
- `packages/evals` — accept/reject fixtures
- `contracts` — Foundry mocks
- `deploy` — Compose

## Status

Scaffolding. See later commits for a runnable demo.
