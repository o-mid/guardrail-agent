# Guardrail Agent

Type an intent. The planner answers with JSON, never calldata, never instruction bytes. Go policy runs schema plus allowlists on that JSON. A human still has to approve each step before the API dry-runs and broadcasts, and the only RPCs this repo talks to are local Anvil and solana-test-validator.

Policy stops a max-uint ERC-20 approve (`infinite_approve`) and a transfer to someone who isn't allowlisted (`recipient_not_allowed`). The UI puts those codes on a banner; there is no Approve button on a rejected plan.

**Latest release:** [v0.1.0](https://github.com/o-mid/guardrail-agent/releases/tag/v0.1.0) · [Changelog](docs/CHANGELOG.md)

## Docs

- [Architecture](docs/architecture.md) - components, trust boundaries, data model
- [Process](docs/process.md) - happy path, rejects, state machines, audit events
- [Demo](docs/demo.md) - local setup, interviewer script, screenshots
- [Threat model](docs/threat-model.md) - assets, controls, residual risk
- [Production gaps](docs/production-gaps.md) - local chains, demo vault, hosted mock planner, fixture evals
- [Scorecard](docs/scorecard.md) - firewall contract and the mock-planner run. Live model not executed.
- [Interview notes](docs/interview-notes.md) - design choices for the /break-it walkthrough
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

Railway runs Mongo, Go policy, the demo vault, Anvil (contracts on boot), and Express. Vercel `NEXT_PUBLIC_API_URL` points at that API. Same demo login as local.

Develop against Compose. The hosted pair is the always-on interview URL. It still runs `PLANNER=mock`. `/break-it` and `/scorecard` run locally; this repo does not publish a new hosted URL for them. There is no screen recording in the repo. The three-minute walkthrough is [docs/demo-script.md](docs/demo-script.md).

## What a run shows

`/break-it` takes unauthenticated text against one standing invoice. Policy either blocks it, with a labeled simulation, or the API broadcasts on local Anvil. `/scorecard` reads `packages/evals/scorecard/firewall.json` and the mock traces next to it. On 7 Nov 2026 that file had 11 stored plans, 11 held, 0 failed. The mock pass had 11 runs, 0 failed, and spent 0 USD. Details and the extra policy codes are in [docs/scorecard.md](docs/scorecard.md).

## What it does not show

A live model has not been executed. The scorecard is not a safety claim. The hosted demo is still the mock router. Limits are in [docs/production-gaps.md](docs/production-gaps.md).

## Planner

`PLANNER=mock` is the default for CI and the hosted demo: a keyword router, no keys. `PLANNER=openai` plus `OPENAI_API_KEY` calls an OpenAI-compatible chat API. `OPENAI_MODEL` defaults to `gpt-4o-mini`. `PLANNER=anthropic` plus `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` calls the Anthropic messages API. A missing key or model throws (fail-closed, no silent fallback to mock). Policy does not change. The logged-in console still waits for a human approve.

`/break-it` takes unauthenticated text and runs that same planner and policy against one standing invoice. If policy allows it, the API broadcasts on local Anvil. If policy blocks it, the page shows a simulation and does not sign. See [production gaps](docs/production-gaps.md).

## Evals

CI posts canned `plan` JSON at Go policy, then posts the attack set in `packages/evals/attacks/v1/` the same way. No planner, no API key. A mismatch prints expected vs actual. Three older denies stay frozen (`infinite_approve`, `recipient_not_allowed`, schema injection), and the attack ids in `FROZEN_ATTACKS` have to keep failing closed. Delete the file or let the case pass and the job fails. Adding a fixture: [packages/evals/README.md](packages/evals/README.md). The public write-up of the last local run is [docs/scorecard.md](docs/scorecard.md).

```bash
cd packages/evals && npm install
POLICY_SERVICE_URL=http://127.0.0.1:8090 npm test
```

Live traces stay off unless `EVAL_PLANNER=openai`. That path calls `createPlanner()`, then `/v1/validate`, and writes `{model, promptHash, plan, policyCodes, latencyMs}` under `packages/evals/traces/` (gitignored). It needs `services/api` deps and a built `plan-schema`.

```bash
cd packages/plan-schema && npm install && npm run build
cd ../../services/api && npm ci
cd ../../packages/evals
EVAL_PLANNER=openai OPENAI_API_KEY=$OPENAI_API_KEY \
  POLICY_SERVICE_URL=http://127.0.0.1:8090 npm run test:live
```

GitHub Actions does not run the live suite on pull requests. `.github/workflows/live-attacks.yml` is a nightly job on this repository only. It skips, and does not fail the build, when `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, or the two `ARENA_USD_PER_MILLION_*` prices are unset. That skip is not a score. `EVAL_PLANNER=mock` is the local second score; traces from that run are in `packages/evals/scorecard/mock-traces/`.

## Limits

Portfolio / interview demo. [docs/production-gaps.md](docs/production-gaps.md) is the list: local Anvil and solana-test-validator only, demo vault is a Bearer-token signer (not MPC), Express can still ask the vault to sign, hosted demo stays on MockPlanner, fixture evals are canned plans not live quality.

## CI

GitHub Actions runs Go policy tests, API typecheck and tests, vault typecheck, Forge tests, Next typecheck, and the fixture evals. The API prints one JSON line per plan `AuditEvent` (`intentId`, `planId`, `policyCodes`, `latencyMs`, `tokens`).
