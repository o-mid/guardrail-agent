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
| `services/api` | Express + Mongo orchestration and executors |
| `services/policy` | Go JSON Schema + policy rules |
| `packages/plan-schema` | Shared plan schema |
| `packages/evals` | Accept/reject fixtures against policy |
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

## Limits

This is a portfolio / interview demo, not production infrastructure.

- Local Anvil and solana-test-validator only by default
- No custodial key management, no mainnet defaults
- MockPlanner is the zero-key default; LLM planner is env-gated and still policy-checked
- Express + Mongo here on purpose for full-stack JD coverage; Go owns policy only
- If the API is compromised, policy could be skipped at the orchestration layer (see threat model)

## CI

GitHub Actions: Go policy tests, API typecheck, Forge tests, Next typecheck, eval fixtures against the policy service.
