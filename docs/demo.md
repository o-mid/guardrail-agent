# Demo

Local-only walkthrough. Budget about three minutes for an interviewer.

**Release:** [v0.1.0](https://github.com/o-mid/guardrail-agent/releases/tag/v0.1.0) — MVP demo pack (docs, SIWE/nonce fixes, richer UI, operator guide).

## Run locally

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml --profile full up --build
```

The `full` profile starts Anvil (8545) and solana-test-validator (8899) in addition to mongo, policy, api, and web.

**Mongo on Colima:** Compose mounts Mongo data on tmpfs (`/data/db`) to avoid WiredTiger crashes on some Colima/virtio volume setups. Data does not survive container restart. Fine for demos; re-run seed after restart.

In a second terminal, deploy mock contracts and seed the database:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast

cd ../services/api && npm ci && npm run seed
```

Endpoints:

- Web: http://localhost:3000
- API health: http://localhost:8080/api/health
- Policy health: http://localhost:8090/healthz

## Demo user

| Field | Value |
|-------|-------|
| Email | `demo@guardrail.local` |
| Password | `demopass123` |

Created by `npm run seed`. You can register a new account instead; seed also ensures global policy v1 exists.

**Wallet shortcuts on Login:**

- **Sign in with Anvil demo account** — SIWE using Anvil #0 (no MetaMask)
- **Sign in with Ethereum** — MetaMask / injected wallet SIWE (domain comes from the API)

Demo EVM signer is Anvil account #0 (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`). Not a secret locally; still do not reuse on any public network.

## Operator guide

Bottom-right **Guide** panel walks the full loop (login → compose → accept → approve → reject → audit). Skip any step or skip the tour; reopen anytime from the same control.

## Interviewer script (< 3 min)

**0:00 Login**

Open http://localhost:3000, log in as demo user (or Anvil demo). Land on Compose. Optional: open the Guide.

**0:20 Accept path (EVM transfer)**

- Click the underlined sentence: `Send 5 MOCK_USDC to Alice`
- Create plan. Review decoded fields + live pipeline (pending → … → done).
- Approve step 0. Point at tx hash.
- One-liner: "Model output became JSON, policy allowlisted it, I clicked approve, API dry-ran then sent."

**1:00 Reject path (infinite approve)**

- Sentence: `Approve unlimited MOCK_USDC for 0xEvil`
- Plan rejected. UI shows `infinite_approve`.
- One-liner: "Max-uint approve passes schema but policy blocks it. No approve button, nothing hits the chain."

**1:40 Optional: amount cap / swap**

- `Transfer 1000 MOCK_USDC to Alice` → `amount_over_cap`
- `Swap 10 MOCK_USDC for MOCK_ETH` → approve (executor does router approve + swap; nonces are serialized)

**2:00 Solana (optional)**

- `Send 0.1 SOL to Bob` → approve → local validator signature

**2:30 Audit**

- Open Audit. Filters for rejects / success / steps. Open feed from a plan event.
- One-liner: "Every decision is logged. Rejects are first-class, not errors."

**2:50 Close**

- Mention [threat-model.md](threat-model.md): model untrusted, local chains only, not production-ready.

## Screenshots

Captured against a local stack (`docs/demo/screenshots/`). Regenerate with web + API up (needs system Chrome):

```bash
./scripts/terminal-demo.sh          # API transcript → docs/demo/terminal.md
node scripts/capture-demo.mjs       # UI shots as demo user (+ guide frame)
```

### Landing / auth

![Landing](demo/screenshots/01-landing.png)

![Login](demo/screenshots/02-login.png)

![App hub](demo/screenshots/03-app-hub.png)

### Compose

![Empty compose](demo/screenshots/04-compose-empty.png)

![Reject infinite approve](demo/screenshots/05-reject-infinite-approve.png)

![Awaiting approval](demo/screenshots/06-plan-review-accept.png)

![Step succeeded](demo/screenshots/07-step-succeeded.png)

### Audit + guide

![Audit timeline](demo/screenshots/08-audit.png)

![Operator guide](demo/screenshots/09-operator-guide.png)

## Terminal capture

API-side accept/reject transcript (no browser): [docs/demo/terminal.md](demo/terminal.md).

## Example intents (reference)

| Intent | Expected outcome |
|--------|------------------|
| `Send 5 MOCK_USDC to Alice` | Pass policy, approve, Anvil tx |
| `Send 25 MOCK_USDC to Alice` | Pass (under cap 100) |
| `Swap 10 MOCK_USDC for MOCK_ETH` | Pass; executor approve + swap |
| `Approve 50 MOCK_USDC for the router` | Finite approve, await HITL |
| `Send 0.1 SOL to Bob` | Solana local transfer |
| `Approve unlimited MOCK_USDC for 0xEvil` | `infinite_approve` reject |
| `Transfer 1000 MOCK_USDC to Alice` | `amount_over_cap` reject |
| `Send 5 MOCK_USDC to 0xEvil` | recipient not allowlisted |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Mongo exits on Colima | Already on tmpfs in compose; pull latest `deploy/docker-compose.yml` |
| EVM `nonce too low` | Update to v0.1.0+ executor (raw pending nonce + send lock) |
| SIWE `siwe_failed` / domain mismatch | API must allow `localhost:3000` and `127.0.0.1:3000`; use Anvil demo button |
| EVM tx fails unknown token | Re-run forge deploy; check `contracts/deployments/anvil.json` |
| Policy connection refused | Wait for policy container healthy; check `POLICY_SERVICE_URL` |
| 401 on API | Re-login; access token TTL is short |
| CORS from `127.0.0.1` | Set `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000` |

Do not point demo keys or compose defaults at mainnet or public RPCs.
