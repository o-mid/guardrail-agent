# Terminal demo session

Captured against a local stack. Commands and responses below.

```bash
# health
curl -s http://127.0.0.1:8080/api/health | jq .
```

```json
{
    "ok": true,
    "mongo": true,
    "policy": true,
    "planner": "mock",
    "evmRpc": "http://127.0.0.1:8545",
    "solanaRpc": "http://127.0.0.1:8899"
}
```

```bash
# login
curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"demo@guardrail.local","password":"demopass123"}'
```

```json
{
  "user": {
    "id": "6a6dad6374ee30b7901f7e59",
    "email": "demo@guardrail.local",
    "evmAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "solanaPubkey": null
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5..."
}
```

```bash
# reject: unlimited approve
curl -s -X POST http://127.0.0.1:8080/api/intents -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"text":"Approve unlimited MOCK_USDC for 0xEvil"}'
```

```json
{
  "plan_status": "rejected_policy",
  "summary": "Approve unlimited MOCK_USDC for spender",
  "policyCodes": [
    "infinite_approve",
    "amount_over_cap"
  ],
  "humanMessages": [
    "step 0 infinite ERC-20 approve is forbidden",
    "total 115792089237316195423570985008687907853269984665640564039457584007913129639935.0000 exceeds cap 100.0000"
  ]
}
```

```bash
# reject: bad recipient
curl -s -X POST http://127.0.0.1:8080/api/intents -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"text":"Send 5 MOCK_USDC to 0xEvil"}'
```

```json
{
  "plan_status": "rejected_policy",
  "summary": "Transfer 5 MOCK_USDC to recipient",
  "policyCodes": [
    "recipient_not_allowed"
  ],
  "humanMessages": [
    "step 0 recipient 0xEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee not allowlisted"
  ]
}
```

```bash
# accept: allowlisted transfer
curl -s -X POST http://127.0.0.1:8080/api/intents -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"text":"Send 5 MOCK_USDC to Alice"}'
```

```json
{
  "plan_id": "6a6f100b8af991ff283e8885",
  "plan_status": "awaiting_approval",
  "summary": "Transfer 5 MOCK_USDC to allowlisted recipient",
  "chain": "anvil",
  "steps": [
    {
      "index": 0,
      "action": "transfer",
      "status": "pending",
      "decodedSummary": "transfer 5 MOCK_USDC to 0x1111111111111111111111111111111111111111"
    }
  ]
}
```

```bash
# approve step 0
curl -s -X POST http://127.0.0.1:8080/api/plans/$PLAN_ID/steps/0/approve \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{}'
```

```json
{
  "plan_status": "completed",
  "step_status": "succeeded",
  "txHash": "0x589c117e30a8c387cf05bbf856732e4bb688d695dbb3a5aedd7c5b4adb0c20a9",
  "dryRunOk": true
}
```

```bash
# audit (latest)
curl -s "http://127.0.0.1:8080/api/audit?limit=8" -H "authorization: Bearer $TOKEN"
```

```json
[
  {
    "type": "plan.completed",
    "entityId": "6a6f100b8af991ff283e8885",
    "createdAt": "2026-08-02T09:38:24.073Z"
  },
  {
    "type": "step.succeeded",
    "entityId": "6a6f100b8af991ff283e8885",
    "createdAt": "2026-08-02T09:38:24.064Z"
  },
  {
    "type": "step.approved",
    "entityId": "6a6f100b8af991ff283e8885",
    "createdAt": "2026-08-02T09:38:19.949Z"
  },
  {
    "type": "plan.awaiting_approval",
    "entityId": "6a6f100b8af991ff283e8885",
    "createdAt": "2026-08-02T09:38:19.858Z"
  },
  {
    "type": "intent.received",
    "entityId": "6a6f100b8af991ff283e887f",
    "createdAt": "2026-08-02T09:38:19.840Z"
  },
  {
    "type": "plan.rejected_policy",
    "entityId": "6a6f100b8af991ff283e887a",
    "createdAt": "2026-08-02T09:38:19.774Z"
  },
  {
    "type": "intent.received",
    "entityId": "6a6f100b8af991ff283e8873",
    "createdAt": "2026-08-02T09:38:19.739Z"
  },
  {
    "type": "plan.awaiting_approval",
    "entityId": "6a6e35da8af991ff283e87d0",
    "createdAt": "2026-08-01T18:07:22.384Z"
  }
]
```
