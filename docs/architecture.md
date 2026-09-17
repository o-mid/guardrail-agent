# Architecture

Guardrail Agent is a local demo stack. Natural language goes in, a structured plan comes out, Go policy says yes or no, a human approves each step, and only then does the API touch chain RPCs. Model output never becomes raw calldata or instruction bytes.

## Context

```mermaid
flowchart LR
  User[User browser]
  Web[Next.js web]
  API[Express API]
  Policy[Go policy service]
  Vault[Demo key vault]
  Mongo[(MongoDB)]
  Anvil[Anvil EVM]
  Solana[solana-test-validator]
  Planner[MockPlanner / LLM]

  User --> Web
  Web -->|JWT REST + SSE| API
  API --> Mongo
  API -->|POST /v1/validate| Policy
  Planner -.->|plan JSON| API
  API -->|sign request| Vault
  API -->|broadcast| Anvil
  API -->|broadcast| Solana
```

The web app is a thin client. It does not talk to chains directly. Orchestration and persistence live in the API. Private keys live in the demo vault process only — the API builds unsigned txs, asks the vault to sign after HITL, then broadcasts. Policy is a separate process so schema and rule checks are not buried inside Express route handlers.

## Service responsibilities

| Component | Role |
|-----------|------|
| **Web** (`apps/web`) | Login, compose intent, view plan steps, approve/reject, audit timeline. Reads/writes via REST. Subscribes to SSE for live step updates. |
| **Express API** (`services/api`) | Auth (email/password, optional SIWE), intent pipeline, plan CRUD, step approval, audit log, chain executors. Owns MongoDB. Calls policy on every new plan. Does not hold chain private keys. |
| **Go policy** (`services/policy`) | Stateless HTTP service. Validates plan JSON against JSON Schema, then applies allowlists and caps from the policy document. Returns machine codes and human messages. |
| **Demo vault** (`services/vault`) | Holds Anvil / Solana demo keys. Signs EVM txs/messages and Solana txs over a local Bearer token. Not threshold MPC — production analog is MPC/HSM. |
| **MongoDB** | Users, refresh tokens, policy versions, intents, plans, plan steps, audit events, SIWE nonces. |
| **Anvil** | Local EVM (chain id 31337). Mock ERC-20 tokens and a swap router deployed via Foundry. |
| **Solana test validator** | Local Solana RPC. MVP executor supports native SOL transfer only. |

## Trust boundaries

| Zone | Trust level | Notes |
|------|-------------|-------|
| MockPlanner / LLM | Untrusted | Output is structural JSON only. Never trusted for amounts, recipients, or bytes. |
| Next.js client | Untrusted | Can be tampered with. Server re-checks ownership and plan state on every approve. |
| Express API | Trusted orchestration | Gates execution. No chain private keys in process env. If compromised, it can still request signatures from the vault. |
| Demo vault | Trusted signing | Keys stay here. Narrow sign APIs only. Local demo token auth. |
| Go policy service | Trusted decisioning | Schema + rules. No chain access. |
| MongoDB | Trusted store | Not exposed publicly. Strict Mongoose schemas. |
| Anvil / Solana RPC | Local demo only | Do not point at mainnet. |

See also [threat-model.md](threat-model.md).

## Plan schema rules

Plans live in `packages/plan-schema/plan.schema.json` and are enforced by the Go service at `/v1/validate`.

Hard constraints:

- **No raw bytes.** Steps use symbolic token names (`MOCK_USDC`, `SOL`), decimal string amounts, and allowlisted action enums. There is no field for hex calldata, contract bytecode, or serialized Solana instructions.
- **`additionalProperties: false`** on the root and every step variant. Extra keys fail schema validation.
- **Fixed chains:** `anvil`, `solana-local`.
- **Step cap:** 1 to 5 steps per plan (schema max; policy also enforces `maxSteps`).
- **Actions:** EVM supports `approve`, `transfer`, `swap`. Solana supports `transfer` only.
- **Amounts:** Decimal strings matching `^(0|[1-9][0-9]*)(\.[0-9]+)?$`. No scientific notation, no hex.

Executors (`services/api/src/executors/`) map symbolic steps to real transactions. That mapping is server-side code, not model output.

## Data model

Mongo collections (Mongoose models in `services/api/src/models/`):

| Collection | Purpose | Key fields |
|------------|---------|------------|
| `users` | Accounts | `email`, `passwordHash`, optional `evmAddress`, `solanaPubkey` |
| `refreshtokens` | Rotating refresh JWTs | `jti`, `userId`, `expiresAt`, `revokedAt` |
| `policies` | Rule documents | `scope` (`global` or user id), `version`, `rules` |
| `intents` | Raw user text | `userId`, `text`, `status`, optional `chainHint` |
| `plans` | Validated or rejected plan | `intentId`, `userId`, `chain`, `summary`, `status`, `rawModelJson`, `rejectionReasons`, `policyVersion` |
| `plansteps` | One row per step | `planId`, `index`, `action`, `payload`, `decodedSummary`, `status`, `dryRunOk`, `txHash`, `error` |
| `auditevents` | Append-only timeline | `type`, `entityId`, `userId`, `payload`, `createdAt` |
| `siwenonces` | SIWE login nonces | `nonce`, `expiresAt` |

Plans always store `rawModelJson` for debugging and audit, even when rejected.

## Stack choices

**Express + Mongo:** Deliberate for a portfolio full-stack shape. Auth, CRUD, SSE, and orchestration fit fine here. Not claiming this is the production choice for high-volume trading.

**Go for policy:** Schema compilation and rule evaluation are isolated, testable, and fast. The API stays dumb about rule details: it forwards JSON and stores the result. Policy codes (`infinite_approve`, `recipient_not_allowed`, etc.) are stable contracts for the UI and eval fixtures.

**Vault for keys:** Demo keys moved out of the API so a compromised orchestrator is not automatically a key dump. Still a single-process signer with a shared token — not multi-party computation. Talk track: "MPC-shaped boundary; production would swap this for Fireblocks-style MPC or an HSM."

**Next.js + Tailwind:** Standard React app shell. No chain SDK in the browser.

**Foundry mocks:** Anvil ships in compose under the `full` profile. Contract addresses land in `contracts/deployments/anvil.json` after `forge script`.

**MockPlanner default:** Keyword router in `services/api/src/planner/mock.ts`. Zero API keys. `PLANNER=openai` with `OPENAI_API_KEY` uses an OpenAI-compatible chat client; output is schema-checked then policy-gated. openai without a key fails closed (no silent mock).
