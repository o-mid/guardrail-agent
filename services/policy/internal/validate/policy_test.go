package validate

import "testing"

func TestInfiniteApprove(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "bad approve",
		"steps": []any{
			map[string]any{
				"action":  "approve",
				"token":   "MOCK_USDC",
				"spender": "0xEvil",
				"amount":  "unlimited",
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "infinite_approve") {
		t.Fatalf("expected infinite_approve, got %v", codes)
	}
}

func TestBadRecipient(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "bad to",
		"steps": []any{
			map[string]any{
				"action": "transfer",
				"token":  "MOCK_USDC",
				"to":     "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead",
				"amount": "5",
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "recipient_not_allowed") {
		t.Fatalf("expected recipient_not_allowed, got %v", codes)
	}
}

func TestHappyTransfer(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "ok",
		"steps": []any{
			map[string]any{
				"action": "transfer",
				"token":  "MOCK_USDC",
				"to":     "0x1111111111111111111111111111111111111111",
				"amount": "5",
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if len(codes) != 0 {
		t.Fatalf("expected clean plan, got %v", codes)
	}
}

func TestOverCap(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "big",
		"steps": []any{
			map[string]any{
				"action": "transfer",
				"token":  "MOCK_USDC",
				"to":     "0x1111111111111111111111111111111111111111",
				"amount": "1000",
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "amount_over_cap") {
		t.Fatalf("expected amount_over_cap, got %v", codes)
	}
}

func TestChainNotAllowed(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "sepolia",
		"summary":       "wrong chain",
		"steps": []any{
			map[string]any{"action": "transfer", "token": "MOCK_USDC", "to": "0x1111111111111111111111111111111111111111", "amount": "1"},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "chain_not_allowed") {
		t.Fatalf("expected chain_not_allowed, got %v", codes)
	}
}

func TestActionNotAllowed(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "solana-local",
		"summary":       "swap on sol",
		"steps": []any{
			map[string]any{
				"action": "swap", "tokenIn": "MOCK_USDC", "tokenOut": "MOCK_ETH",
				"amountIn": "1", "minAmountOut": "1", "maxSlippageBps": 10,
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "action_not_allowed") {
		t.Fatalf("expected action_not_allowed, got %v", codes)
	}
}

func TestMintNotAllowed(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "bad token",
		"steps": []any{
			map[string]any{"action": "transfer", "token": "USDT", "to": "0x1111111111111111111111111111111111111111", "amount": "1"},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "mint_not_allowed") {
		t.Fatalf("expected mint_not_allowed, got %v", codes)
	}
}

func TestMaxSteps(t *testing.T) {
	steps := []any{}
	for i := 0; i < 6; i++ {
		steps = append(steps, map[string]any{
			"action": "transfer",
			"token":  "MOCK_USDC",
			"to":     "0x1111111111111111111111111111111111111111",
			"amount": "1",
		})
	}
	plan := map[string]any{"schemaVersion": "1", "chain": "anvil", "summary": "many", "steps": steps}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "max_steps_exceeded") {
		t.Fatalf("expected max_steps_exceeded, got %v", codes)
	}
}

func TestSlippageTooHigh(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "slip",
		"steps": []any{
			map[string]any{
				"action": "swap", "tokenIn": "MOCK_USDC", "tokenOut": "MOCK_ETH",
				"amountIn": "1", "minAmountOut": "0.001", "maxSlippageBps": 500,
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if !hasCode(codes, "slippage_too_high") {
		t.Fatalf("expected slippage_too_high, got %v", codes)
	}
}

func TestHappySwap(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "swap ok",
		"steps": []any{
			map[string]any{
				"action": "swap", "tokenIn": "MOCK_USDC", "tokenOut": "MOCK_ETH",
				"amountIn": "10", "minAmountOut": "0.001", "maxSlippageBps": 50,
			},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if len(codes) != 0 {
		t.Fatalf("expected clean swap, got %v", codes)
	}
}

func TestHappySolana(t *testing.T) {
	p := defaultPolicy()
	p.Rules.AllowRecipients["solana-local"] = []string{"496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK"}
	p.Rules.AllowTokens["solana-local"] = []string{"SOL"}
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "solana-local",
		"summary":       "sol ok",
		"steps": []any{
			map[string]any{"action": "transfer", "mint": "SOL", "to": "496mWS1YCGE7YVzGzqifoRvzmtgUvgG1Mz3vht22GsSK", "amount": "0.1"},
		},
	}
	codes, _ := CheckPolicy(plan, p)
	if len(codes) != 0 {
		t.Fatalf("expected clean solana transfer, got %v", codes)
	}
}

func TestFiniteApproveOk(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "approve ok",
		"steps": []any{
			map[string]any{"action": "approve", "token": "MOCK_USDC", "spender": "0x1111111111111111111111111111111111111111", "amount": "10"},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if hasCode(codes, "infinite_approve") {
		t.Fatalf("finite approve should pass infinite check, got %v", codes)
	}
}

func TestIsInfiniteHelpers(t *testing.T) {
	if !isInfiniteApprove("unlimited") || !isInfiniteApprove("max") {
		t.Fatal("keyword infinite detection failed")
	}
	if isInfiniteApprove("10") {
		t.Fatal("finite amount flagged")
	}
}

func TestSelfRecipientAllowed(t *testing.T) {
	plan := map[string]any{
		"schemaVersion": "1",
		"chain":         "anvil",
		"summary":       "self",
		"steps": []any{
			map[string]any{"action": "transfer", "token": "MOCK_USDC", "to": "self", "amount": "1"},
		},
	}
	codes, _ := CheckPolicy(plan, defaultPolicy())
	if hasCode(codes, "recipient_not_allowed") {
		t.Fatalf("self should be allowed, got %v", codes)
	}
}

func defaultPolicy() PolicyDoc {
	return PolicyDoc{
		Version: 1,
		Rules: Rules{
			MaxSteps: 5,
			MaxAmount: "100",
			Chains:    []string{"anvil", "solana-local"},
			Actions: map[string][]string{
				"anvil":         {"approve", "transfer", "swap"},
				"solana-local":  {"transfer"},
			},
			AllowRecipients: map[string][]string{
				"anvil": {"0x1111111111111111111111111111111111111111"},
			},
			AllowTokens: map[string][]string{
				"anvil": {"MOCK_USDC", "MOCK_ETH"},
			},
			MaxSlippageBps:        100,
			ForbidInfiniteApprove: true,
			AllowAutonomous:       false,
		},
	}
}

func hasCode(codes []string, want string) bool {
	for _, c := range codes {
		if c == want {
			return true
		}
	}
	return false
}
