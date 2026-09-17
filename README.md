# Guardrail Agent

Natural-language chain intent, schema-checked plan, Go policy gate, human approve per step, dry-run then execute on local EVM (Anvil) and Solana (test validator).

Model output never becomes raw calldata or instruction bytes. Reject paths are part of the product, not edge cases.

**Latest release:** [v0.1.0](https://github.com/o-mid/guardrail-agent/releases/tag/v0.1.0) · [Changelog](docs/CHANGELOG.md)

## Docs

- [Architecture](docs/architecture.md) - components, trust boundaries, data model
- [Process](docs/process.md) - happy path, rejects, state machines, audit events
- [Demo](docs/demo.md) - local setup, interviewer script, screenshots
- [Threat model](docs/threat-model.md) - assets, controls, residual risk
- [Changelog](docs/CHANGELOG.md)

## Stack

| Path | Role |
|------|------|
| `apps/web` | Next.js + Tailwind UI |
| `services/api` | Express + Mongo orchestration and executors (no chain keys) |
| `services/policy` | Go JSON Schema + policy rules |
| `services/vault` | Demo key vault (signs after HITL; not threshold MPC) |
| `packages/plan-schema` | Shared plan schema |
| `packages/evals` | Canned-plan fixtures against policy; optional live traces |
| `contracts` | Foundry mocks for Anvil |

## Quick start

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml --profile full up --build
```

Deploy mocks and seed (second terminal):

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

cd ../services/api && npm ci && npm run seed
```

Web: http://localhost:3000  
API: http://localhost:8080/api/health

Demo login: `demo@guardrail.local` / `demopass123`

## Hosted demo

| Layer | URL |
|-------|-----|
| UI (Vercel) | https://guardrail-agent-six.vercel.app |
| API (Railway) | https://api-production-c5d48.up.railway.app |

Stack on Railway: MongoDB + Go policy + demo vault + Anvil (+ contract deploy on boot) + Express API. `NEXT_PUBLIC_API_URL` on Vercel points at the Railway API. Demo login: `demo@guardrail.local` / `demopass123`.

Local Docker Compose remains the primary way to develop; Railway is for the always-on interview demo.

## Planner

`PLANNER=mock` (default, CI, hosted demo) is the keyword router. `PLANNER=openai` plus `OPENAI_API_KEY` hits an OpenAI-compatible chat completions API. `OPENAI_MODEL` is optional (default `gpt-4o-mini`). Missing key fails closed. Live planner is optional; policy and human approve do not change.

## Evals

Fixture evals send canned `plan` JSON to the Go policy service. CI uses this path. No planner, no `OPENAI_API_KEY`. A fail prints expected vs actual. Three denies are frozen (`infinite_approve`, `recipient_not_allowed`, schema injection): CI fails if those fixtures vanish or start passing. How to add one: [packages/evals/README.md](packages/evals/README.md).

```bash
cd packages/evals && npm install
POLICY_SERVICE_URL=http://127.0.0.1:8090 npm test
```

Live planner traces are off unless `EVAL_PLANNER=openai`. The runner calls `createPlanner()`, then `/v1/validate`, and writes `{model, promptHash, plan, policyCodes, latencyMs}` under `packages/evals/traces/` (gitignored). Needs `services/api` deps and a built `plan-schema` because the live client lives in the API.

```bash
cd packages/plan-schema && npm install && npm run build
cd ../../services/api && npm ci
cd ../../packages/evals
EVAL_PLANNER=openai OPENAI_API_KEY=$OPENAI_API_KEY \
  POLICY_SERVICE_URL=http://127.0.0.1:8090 npm run test:live
```

GitHub Actions does not run the live suite.

## Limits

This is a portfolio / interview demo, not production infrastructure.

- Local Anvil and solana-test-validator only by default
- Demo key vault holds keys; not real threshold MPC / HSM, no mainnet defaults
- MockPlanner is the zero-key default. Live planner is env-gated (`PLANNER=openai`) and still policy-checked; hosted demo stays mock
- Express + Mongo here on purpose for full-stack JD coverage; Go owns policy; vault owns signing
- If the API is compromised, policy could be skipped and the vault can still be asked to sign (see threat model)

## CI

GitHub Actions: Go policy tests, API typecheck and tests, vault typecheck, Forge tests, Next typecheck, canned-plan eval fixtures against the policy service.
