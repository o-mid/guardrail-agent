#!/bin/sh
set -eu

anvil --host 0.0.0.0 --chain-id 31337 --port 8545 &
ANVIL_PID=$!

i=0
while [ "$i" -lt 60 ]; do
  if cast block-number --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

cd /contracts
forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast

echo "anvil mocks deployed"
wait "$ANVIL_PID"
