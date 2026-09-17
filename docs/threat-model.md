# Threat model

Guardrail Agent treats model output as untrusted input. Plans are structural JSON only. Executors map allowlisted actions to calldata / instructions. Humans approve each step before submit. Demo chain keys live in a separate vault process.

What this repo is not (local chains, demo vault, Express still able to call the vault, hosted MockPlanner, fixture evals) is listed in [production-gaps.md](production-gaps.md).

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

Approve and vault-sign re-run Go `/v1/validate` on the current `PlanStep.payload` rows (not `rawModelJson`) using `loadPolicy(userId)` — the latest user-scoped or global rules, not a frozen copy from plan create. A later policy bump can reject a plan that passed at intent time. Mutating recipient or amount in Mongo should fail the approve claim and fail again immediately before `vaultSignEvmTx` / `vaultSignSolanaTx`, so skipping orchestration is harder than it was when only the intent-time gate existed.

If Express is compromised it can still omit those calls and ask the vault to sign with the same local Bearer token. The vault split keeps keys out of the API process and makes an MPC/HSM swap obvious; it is not threshold custody. Keep demo keys off any public network. See [production-gaps.md](production-gaps.md).
