# Demo script (< 3 min)

1. `cp .env.example .env`
2. `docker compose -f deploy/docker-compose.yml --profile full up --build`
3. Deploy mocks to Anvil (from `contracts/`):
   `forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast`
4. Seed: `cd services/api && npm run seed`
5. Open http://localhost:3000 — register or use `demo@guardrail.local` / `demopass123`
6. Compose: `Send 5 MOCK_USDC to Alice` → approve → show tx hash
7. Compose: `Approve unlimited MOCK_USDC for 0xEvil` → show `infinite_approve` reject
8. Compose: `Send 0.1 SOL to Bob` → approve → show signature
9. Open Audit — show accept, reject, and execute events

Local / mock chains only. Do not point demo keys at mainnet.
