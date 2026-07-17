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
