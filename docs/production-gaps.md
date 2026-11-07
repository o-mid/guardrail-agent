# What is not production

Guardrail Agent is a portfolio / interview demo. The happy-path docs show what the stack does locally. This page is the constraints that go with that.

## Local chains

Compose, Foundry deploy, and the executors talk to Anvil (`31337`) and `solana-test-validator`. Those are the only supported RPCs. Demo keys are the well-known Anvil account #0 and a local Solana keypair. Nothing here is configured for mainnet. Pointing it there would reuse those keys.

## Demo vault is not MPC

`services/vault` is one Node process with the private keys in memory / env. It signs after HITL over a local Bearer token. The process boundary exists so the API does not dump keys on a crash or a log line. It is not threshold MPC, not an HSM, not Fireblocks.

## Express can still call the vault

Approve and the pre-sign path re-run Go `/v1/validate` on the stored step payload. Mutating recipient or amount in Mongo should fail there. If Express itself is compromised, it can skip policy and still `POST` the vault with the same token. Keys are out of the API process; a hostile orchestrator can still request signatures. [Threat model](threat-model.md) residual risk covers the same point.

## Hosted demo uses MockPlanner

The Vercel + Railway demo runs `PLANNER=mock`. That keyword router needs no API key and is deterministic. `PLANNER=openai` fails closed without `OPENAI_API_KEY`. `PLANNER=anthropic` fails closed without `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Both still go through schema and policy. This repo does not ship a key. The public URL does not put a live model in the loop until those vars are set on the host.

## /break-it can broadcast without the approve click

`/break-it` has no account. If policy allows the plan, the API broadcasts it on local Anvil (or solana-local if a plan for that chain gets through). A blocked plan shows a simulation and is not signed. The logged-in console still requires a human approve. Visitor text is not stored. Totals, the spend window, and paid invoice ids sit in API memory and disappear on restart. The daily dollar cap does nothing useful until `ARENA_USD_PER_MILLION_INPUT` and `ARENA_USD_PER_MILLION_OUTPUT` are set, because this repo does not invent a model price. Boot refuses an EVM chain id other than 31337 and any RPC host outside local Anvil and solana-test-validator.

## Fixture evals are not live quality

CI posts canned `plan` JSON at the Go policy service, including `packages/evals/attacks/v1/`. That is a regression contract for schema and policy (frozen `infinite_approve`, `recipient_not_allowed`, schema injection, and the attack ids that have to keep failing closed). It does not score a live model. The mock-planner pass under `packages/evals/scorecard/mock-traces/` is a keyword router, one repeat, 0 USD. A live model suite has not been executed. The nightly workflow skips when the Anthropic key, model, or token prices are unset, and that skip is not a pass. `npm run test:live` stays opt-in. How to add a fixture: [packages/evals/README.md](../packages/evals/README.md). The last local numbers are in [scorecard.md](scorecard.md).
