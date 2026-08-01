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
# accept: allowlisted transfer
curl -s -X POST http://127.0.0.1:8080/api/intents -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"text":"Send 5 MOCK_USDC to Alice"}'
```

```json
{
  "plan_id": "6a6daf583513e932f7fea9d6",
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
  "txHash": "0x597c49cb638c2a65260e70123622a215bcdbe0aa0e7c69914a644c01d564ca0c",
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
    "entityId": "6a6daf583513e932f7fea9d6",
    "createdAt": "2026-08-01T08:33:28.604Z"
  },
  {
    "type": "step.succeeded",
    "entityId": "6a6daf583513e932f7fea9d6",
    "createdAt": "2026-08-01T08:33:28.591Z"
  },
  {
    "type": "step.approved",
    "entityId": "6a6daf583513e932f7fea9d6",
    "createdAt": "2026-08-01T08:33:28.366Z"
  },
  {
    "type": "plan.awaiting_approval",
    "entityId": "6a6daf583513e932f7fea9d6",
    "createdAt": "2026-08-01T08:33:28.280Z"
  },
  {
    "type": "intent.received",
    "entityId": "6a6daf583513e932f7fea9d0",
    "createdAt": "2026-08-01T08:33:28.266Z"
  },
  {
    "type": "plan.rejected_policy",
    "entityId": "6a6daf583513e932f7fea9cb",
    "createdAt": "2026-08-01T08:33:28.221Z"
  },
  {
    "type": "intent.received",
    "entityId": "6a6daf583513e932f7fea9c4",
    "createdAt": "2026-08-01T08:33:28.207Z"
  },
  {
    "type": "plan.rejected_policy",
    "entityId": "6a6daf4a3513e932f7fea9bc",
    "createdAt": "2026-08-01T08:33:14.227Z"
  }
]
```
