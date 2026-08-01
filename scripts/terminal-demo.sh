#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:8080}"
OUT="${OUT:-docs/demo/terminal.md}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

{
  echo "# Terminal demo session"
  echo
  echo "Captured against a local stack. Commands and responses below."
  echo
  echo '```bash'
  echo "# health"
  echo "curl -s $API/api/health | jq ."
  echo '```'
  echo
  echo '```json'
  curl -s "$API/api/health" | python3 -m json.tool
  echo '```'
  echo

  echo '```bash'
  echo "# login"
  echo "curl -s -X POST $API/api/auth/login \\"
  echo "  -H 'content-type: application/json' \\"
  echo "  -d '{\"email\":\"demo@guardrail.local\",\"password\":\"demopass123\"}'"
  echo '```'
  echo
  curl -s -X POST "$API/api/auth/login" \
    -H 'content-type: application/json' \
    -d '{"email":"demo@guardrail.local","password":"demopass123"}' > "$TMP/login.json"
  TOKEN=$(python3 -c 'import json; print(json.load(open("'"$TMP"'/login.json"))["accessToken"])')
  echo '```json'
  python3 -c 'import json; d=json.load(open("'"$TMP"'/login.json")); print(json.dumps({"user": d["user"], "accessToken": d["accessToken"][:24]+"..."}, indent=2))'
  echo '```'
  echo

  echo '```bash'
  echo "# reject: unlimited approve"
  echo "curl -s -X POST $API/api/intents -H \"authorization: Bearer \$TOKEN\" \\"
  echo "  -H 'content-type: application/json' \\"
  echo "  -d '{\"text\":\"Approve unlimited MOCK_USDC for 0xEvil\"}'"
  echo '```'
  echo
  curl -s -X POST "$API/api/intents" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -d '{"text":"Approve unlimited MOCK_USDC for 0xEvil"}' > "$TMP/rej.json"
  echo '```json'
  python3 -c 'import json; d=json.load(open("'"$TMP"'/rej.json")); plan=d.get("plan") or {}; val=d.get("validation") or {}; print(json.dumps({"plan_status": plan.get("status"), "summary": plan.get("summary"), "policyCodes": val.get("policyCodes") or plan.get("rejectionReasons"), "humanMessages": val.get("humanMessages")}, indent=2))'
  echo '```'
  echo

  echo '```bash'
  echo "# accept: allowlisted transfer"
  echo "curl -s -X POST $API/api/intents -H \"authorization: Bearer \$TOKEN\" \\"
  echo "  -H 'content-type: application/json' \\"
  echo "  -d '{\"text\":\"Send 5 MOCK_USDC to Alice\"}'"
  echo '```'
  echo
  curl -s -X POST "$API/api/intents" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -d '{"text":"Send 5 MOCK_USDC to Alice"}' > "$TMP/acc.json"
  PLAN_ID=$(python3 -c 'import json; print(json.load(open("'"$TMP"'/acc.json"))["plan"]["_id"])')
  echo '```json'
  python3 -c 'import json; d=json.load(open("'"$TMP"'/acc.json")); plan=d.get("plan") or {}; steps=d.get("steps") or []; print(json.dumps({"plan_id": plan.get("_id"), "plan_status": plan.get("status"), "summary": plan.get("summary"), "chain": plan.get("chain"), "steps": [{"index": s.get("index"), "action": s.get("action"), "status": s.get("status"), "decodedSummary": s.get("decodedSummary")} for s in steps]}, indent=2))'
  echo '```'
  echo

  echo '```bash'
  echo "# approve step 0"
  echo "curl -s -X POST $API/api/plans/\$PLAN_ID/steps/0/approve \\"
  echo "  -H \"authorization: Bearer \$TOKEN\" -H 'content-type: application/json' -d '{}'"
  echo '```'
  echo
  curl -s -X POST "$API/api/plans/$PLAN_ID/steps/0/approve" \
    -H "authorization: Bearer $TOKEN" \
    -H 'content-type: application/json' \
    -d '{}' > "$TMP/apr.json"
  echo '```json'
  python3 -c 'import json; d=json.load(open("'"$TMP"'/apr.json")); step=d.get("step") or {}; plan=d.get("plan") or {}; print(json.dumps({"plan_status": plan.get("status"), "step_status": step.get("status"), "txHash": step.get("txHash"), "dryRunOk": step.get("dryRunOk")}, indent=2))'
  echo '```'
  echo

  echo '```bash'
  echo "# audit (latest)"
  echo "curl -s \"$API/api/audit?limit=8\" -H \"authorization: Bearer \$TOKEN\""
  echo '```'
  echo
  curl -s "$API/api/audit?limit=8" -H "authorization: Bearer $TOKEN" > "$TMP/aud.json"
  echo '```json'
  python3 -c 'import json; d=json.load(open("'"$TMP"'/aud.json")); print(json.dumps([{"type": e.get("type"), "entityId": e.get("entityId"), "createdAt": e.get("createdAt")} for e in d.get("events", [])[:8]], indent=2))'
  echo '```'
} > "$OUT"

echo "wrote $OUT"
