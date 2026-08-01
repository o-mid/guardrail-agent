# Guardrail Agent

Natural-language chain intent → schema-checked plan → Go policy → human approve → dry-run / execute on local EVM (ethers.js) and Solana (web3.js).

Model output never becomes raw calldata or instruction bytes. Reject paths are part of the product.

## Stack

- `apps/web` — Next.js + Tailwind
- `services/api` — Express + Mongo + planners + executors
- `services/policy` — Go schema + policy service
- `packages/plan-schema` — shared plan schema
- `packages/evals` — accept/reject fixtures
- `contracts` — Foundry mocks

## Quick start

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml --profile full up --build
```

In another shell, deploy mocks and seed:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

cd ../services/api && npm ci && npm run seed
```

Web: http://localhost:3000
API health: http://localhost:8080/api/health

Demo user after seed: `demo@guardrail.local` / `demopass123`

## What to show

1. Allowlisted transfer — approve — Anvil tx
2. Unlimited approve — `infinite_approve` reject
3. SOL transfer on local validator
4. Audit timeline

Details: [docs/demo-script.md](docs/demo-script.md) · [docs/threat-model.md](docs/threat-model.md)

## Limits

- Local / Anvil / solana-test-validator by default
- No custodial keys, no mainnet defaults
- MockPlanner is the zero-key default; LLM planner is env-gated and still policy-checked
- Portfolio project: Express + Mongo here on purpose for full-stack JDs; Go owns policy only

## CI

GitHub Actions runs Go policy tests, API typecheck, Forge tests, Next typecheck, and eval fixtures against the policy service.
