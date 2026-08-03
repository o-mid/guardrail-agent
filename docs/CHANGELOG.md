# Changelog

## v0.1.1 — 2026-08-03

### Product
- Loud reject UX for `recipient_not_allowed` alongside `infinite_approve` (Compose examples, Guide, `PolicyReject` headlines)
- Demo key vault (`services/vault`): chain private keys leave the API; API requests signatures after HITL

### Docs / demo
- Architecture + threat model updated for the vault boundary (not threshold MPC)
- Dual reject interviewer script; screenshot `06-reject-recipient.png`

### Reliability
- Vault EVM sign payload serializes BigInt fields for JSON

## v0.1.0 — 2026-08-02

First tagged MVP release for interview demos.

### Docs
- Architecture, process, threat model, and demo walkthrough
- Terminal transcript + UI screenshot pack (including operator guide)

### Reliability
- SIWE domain aligned with browser origin (`localhost:3000` / `127.0.0.1:3000`)
- Anvil nonce races fixed (raw pending nonce, serialized sends, atomic step claim)
- API lockfile uuid override sync for CI `npm ci`

### Product UI
- Compose: sentence examples, live step pipelines, payload detail, SSE updates
- Audit: filters, summary counts, expandable events
- Operator guide (bottom-right, skippable tour)
- Control-plane visual polish (brand mark, atmosphere, shared page header)

### Limits
- Local Anvil / solana-test-validator only
- MockPlanner default; not production-ready (see threat model)
