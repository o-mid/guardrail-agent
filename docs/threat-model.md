# Threat model

Treat planner output as untrusted. Plans are structural JSON only; executors map allowlisted actions to calldata / instructions. A human approves each step before submit. Demo chain keys live in a separate vault process.

What this repo is not (local chains, demo vault, Express still able to call the vault, hosted MockPlanner, fixture evals, no live-model scorecard) is listed in [production-gaps.md](production-gaps.md).

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
| Chain RPCs | Local demo environment. Boot refuses any EVM RPC or chain id that is not Anvil 31337, and any Solana RPC that is not the local validator. |
| Public /break-it visitor | Untrusted. No account. Text is plain, length-capped, and never fetched as a URL. |

## Threats and controls

| Threat | Control |
|--------|---------|
| Prompt injection → hostile plan | JSON Schema + Go policy; no model hex/bytes |
| Infinite ERC-20 approve | `infinite_approve` deny + loud UI |
| Wrong recipient / mint | Allowlists (`recipient_not_allowed`, `mint_not_allowed`) + loud UI |
| Silent auto-exec | The logged-in console requires a per-step approve. `/break-it` broadcasts only after policy allows, and a block is labeled as a simulation that is not signed. |
| IDOR on plans | JWT ownership checks |
| Replay approve | Idempotent step success |
| JWT theft | Short access TTL; rotate refresh |
| Mongo injection | Zod + Mongoose strict schemas |
| Key dump from API process | Keys only in `services/vault`; API requests signatures |
| Key leak in demo | `.env` gitignored; Anvil default key only in vault compose env |
| Visitor text on /break-it | Plain text, 2000 character cap, no shell, no query, no URL fetch. Rate limit key is a hash of the address plus a salt. Raw addresses are not stored. |
| Arena spend past the cap | `ARENA_DAILY_USD_CAP`. A live planner also needs both per-million prices set, or the call is not made. `ARENA_KILL_SWITCH` leaves a recorded mock attempt on the page. |
| Lookalike or swapped payee | `lookalike_recipient`, `recipient_swap`. Allowlist membership is not enough when the task names one vendor. |
| Split under the per-payment cap | `spend_window_exceeded` uses a 24h sum per agent hash and per recipient. The window is in memory. |
| Same invoice twice | `duplicate_invoice` for that agent hash. The set is in memory. |
| Instructions in memo or an earlier turn | `memo_smuggle`, `hex_smuggle`, `delayed_instruction` |
| Approval screen repeats the model | The approve control shows fields taken from the step payload. The model summary is labeled as the model's sentence. |

## Out of scope for this release

Mainnet trading, real threshold MPC / multi-party key shares, autonomous loops, production HSM integration.

## Residual risk

Approve and vault-sign re-run Go `/v1/validate` on the current `PlanStep.payload` rows (not `rawModelJson`) using `loadPolicy(userId)`. That is the latest user-scoped or global rules, not a frozen copy from plan create. A later policy bump can reject a plan that passed at intent time. Mutating recipient or amount in Mongo should fail the approve claim and fail again immediately before `vaultSignEvmTx` / `vaultSignSolanaTx`.

If Express is compromised it can still omit those calls and ask the vault to sign with the same local Bearer token. The vault split keeps keys out of the API process and makes an MPC/HSM swap obvious. It is not threshold custody. Keep demo keys off any public network. See [production-gaps.md](production-gaps.md).
