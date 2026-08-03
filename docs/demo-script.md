# Demo script (< 3 min)

Full setup, interviewer script, screenshots, and terminal transcript: [demo.md](demo.md).

Short path:

1. Bring up stack + seed (see demo.md).
2. Login `demo@guardrail.local` / `demopass123` (or Anvil demo SIWE via vault).
3. Accept: `Send 5 MOCK_USDC to Alice` → Approve → show Anvil tx.
4. Reject A: `Approve unlimited MOCK_USDC for 0xEvil` → `infinite_approve`.
5. Reject B: `Send 5 MOCK_USDC to 0xEvil` → `recipient_not_allowed`.
6. Optional: swap / Solana sentence + Audit page.
7. Optional: walk the bottom-right Guide (includes both reject steps).

Local / mock chains only. Keys stay in `services/vault`. Do not point demo keys at mainnet.
