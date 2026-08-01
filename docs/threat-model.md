# Threat model

Guardrail Agent treats model output as untrusted input. Plans are structural JSON only. Executors map allowlisted actions to calldata / instructions. Humans approve each step before submit.

## Assets

- Demo private keys (local Anvil / solana-test-validator only)
- User session JWTs
- Policy documents and audit history
- Ability to submit transactions on local chains

## Trust boundaries

| Zone | Trust |
|------|-------|
| LLM / MockPlanner | Untrusted |
| Next.js client | Untrusted |
| Express API | Trusted orchestration |
| Go policy service | Trusted decisioning |
| MongoDB | Trusted store (no public access) |
| Chain RPCs | Local demo environment |

## Threats and controls

| Threat | Control |
|--------|---------|
| Prompt injection → hostile plan | JSON Schema + Go policy; no model hex/bytes |
| Infinite ERC-20 approve | `infinite_approve` deny |
| Wrong recipient / mint | Allowlists |
| Silent auto-exec | Server requires per-step approve events |
| IDOR on plans | JWT ownership checks |
| Replay approve | Idempotent step success |
| JWT theft | Short access TTL; rotate refresh |
| Mongo injection | Zod + Mongoose strict schemas |
| Key leak in demo | `.env` gitignored; Anvil default key only in compose |

## Out of scope for this release

Mainnet trading, custodial MPC, autonomous loops, production key management.

## Residual risk

If Express is compromised, policy can be skipped at the orchestration layer. Keep policy checks mandatory on the approve path and keep demo keys off any public network.
