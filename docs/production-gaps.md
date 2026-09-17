# What is not production

Guardrail Agent is a portfolio / interview demo. The happy-path docs show what the stack does locally. This page is the constraints that go with that.

## Local chains

Compose, Foundry deploy, and the executors talk to Anvil (`31337`) and `solana-test-validator`. Those are the only supported RPCs. Demo keys are the well-known Anvil account #0 and a local Solana keypair. Nothing here is configured for mainnet. Pointing it there would reuse those keys.

## Demo vault is not MPC

`services/vault` is one Node process with the private keys in memory / env. It signs after HITL over a local Bearer token. The process boundary exists so the API does not dump keys on a crash or a log line. It is not threshold MPC, not an HSM, not Fireblocks.

## Express can still call the vault

Approve and the pre-sign path re-run Go `/v1/validate` on the stored step payload. Mutating recipient or amount in Mongo should fail there. If Express itself is compromised, it can skip policy and still `POST` the vault with the same token. Keys are out of the API process; a hostile orchestrator can still request signatures. [Threat model](threat-model.md) residual risk covers the same point.

## Hosted demo uses MockPlanner

The Vercel + Railway demo runs `PLANNER=mock`. That keyword router needs no API key and is deterministic. `PLANNER=openai` exists for local use, fails closed without `OPENAI_API_KEY`, and still goes through schema + policy. The public URL does not put a live model in the loop.

## Fixture evals are not live quality

CI posts canned `plan` JSON at the Go policy service. That is a regression contract for schema and policy (including frozen `infinite_approve`, `recipient_not_allowed`, and schema injection). It does not score planner quality, live prompt-injection resistance, or on-chain execution. `npm run test:live` is opt-in and not in GitHub Actions. How to add a fixture: [packages/evals/README.md](../packages/evals/README.md).
