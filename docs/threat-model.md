# Threat model

Guardrail Agent treats model output as untrusted input. Plans are structural JSON only. Executors map allowlisted actions to calldata / instructions. Humans approve each step before submit. Demo chain keys live in a separate vault process.

## Assets

- Demo private keys (vault process only; local Anvil / solana-test-validator)
- User session JWTs
- Policy documents and audit history
- Ability to submit transactions on local chains

## Trust boundaries

| Zone | Trust |
|------|-------|
| LLM / MockPlanner | Untrusted |
| Next.js client | Untrusted |
| Express API | Trusted orchestration (no private keys) |
| Demo key vault | Trusted signing |
| Go policy service | Trusted decisioning |
| MongoDB | Trusted store (no public access) |
| Chain RPCs | Local demo environment |

## Threats and controls

| Threat | Control |
|--------|---------|
| Prompt injection → hostile plan | JSON Schema + Go policy; no model hex/bytes |
| Infinite ERC-20 approve | `infinite_approve` deny + loud UI |
| Wrong recipient / mint | Allowlists (`recipient_not_allowed`, `mint_not_allowed`) + loud UI |
| Silent auto-exec | Server requires per-step approve events |
| IDOR on plans | JWT ownership checks |
| Replay approve | Idempotent step success |
| JWT theft | Short access TTL; rotate refresh |
| Mongo injection | Zod + Mongoose strict schemas |
| Key dump from API process | Keys only in `services/vault`; API requests signatures |
| Key leak in demo | `.env` gitignored; Anvil default key only in vault compose env |

## Out of scope for this release

Mainnet trading, real threshold MPC / multi-party key shares, autonomous loops, production HSM integration.

## Residual risk

If Express is compromised, policy can still be skipped at the orchestration layer, and the attacker can ask the vault to sign (local Bearer token). The vault split removes "keys sitting in the API env" and makes the production MPC/HSM swap obvious — it is not a substitute for threshold custody. Keep policy checks mandatory on the approve path and keep demo keys off any public network.
