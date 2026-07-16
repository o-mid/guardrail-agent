package validate

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
)

func CheckPolicy(plan any, policy PolicyDoc) (codes []string, messages []string) {
	m, ok := plan.(map[string]any)
	if !ok {
		return []string{"action_not_allowed"}, []string{"plan is not an object"}
	}
	rules := policy.Rules
	chain, _ := m["chain"].(string)
	if !contains(rules.Chains, chain) {
		codes = append(codes, "chain_not_allowed")
		messages = append(messages, fmt.Sprintf("chain %s is not enabled", chain))
	}

	steps, _ := m["steps"].([]any)
	if rules.MaxSteps > 0 && len(steps) > rules.MaxSteps {
		codes = append(codes, "max_steps_exceeded")
		messages = append(messages, fmt.Sprintf("steps %d exceed max %d", len(steps), rules.MaxSteps))
	}

	allowedActions := rules.Actions[chain]
	allowedTokens := setOf(rules.AllowTokens[chain])
	total := new(big.Rat)
	capAmt, capErr := parseAmount(rules.MaxAmount)
	if capErr != nil {
		capAmt = big.NewRat(100, 1)
	}

	for i, raw := range steps {
		step, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		action, _ := step["action"].(string)
		if len(allowedActions) > 0 && !contains(allowedActions, action) {
			codes = append(codes, "action_not_allowed")
			messages = append(messages, fmt.Sprintf("step %d action %s not allowed on %s", i, action, chain))
		}

		switch action {
		case "approve":
			token, _ := step["token"].(string)
			if len(allowedTokens) > 0 && !allowedTokens[token] {
				codes = append(codes, "mint_not_allowed")
				messages = append(messages, fmt.Sprintf("step %d token %s not allowlisted", i, token))
			}
			if amt, err := parseAmount(asString(step["amount"])); err == nil {
				total.Add(total, amt)
			}
		case "swap":
			in, _ := step["tokenIn"].(string)
			out, _ := step["tokenOut"].(string)
			if len(allowedTokens) > 0 && (!allowedTokens[in] || !allowedTokens[out]) {
				codes = append(codes, "mint_not_allowed")
				messages = append(messages, fmt.Sprintf("step %d swap tokens not allowlisted", i))
			}
			bps := asInt(step["maxSlippageBps"])
			if rules.MaxSlippageBps > 0 && bps > rules.MaxSlippageBps {
				codes = append(codes, "slippage_too_high")
				messages = append(messages, fmt.Sprintf("step %d slippage %d > max %d", i, bps, rules.MaxSlippageBps))
			}
			if amt, err := parseAmount(asString(step["amountIn"])); err == nil {
				total.Add(total, amt)
			}
		case "transfer":
			token := asString(step["token"])
			if token == "" {
				token = asString(step["mint"])
			}
			if len(allowedTokens) > 0 && !allowedTokens[token] {
				codes = append(codes, "mint_not_allowed")
				messages = append(messages, fmt.Sprintf("step %d token/mint %s not allowlisted", i, token))
			}
			if amt, err := parseAmount(asString(step["amount"])); err == nil {
				total.Add(total, amt)
			}
		}
	}

	if total.Cmp(capAmt) > 0 {
		codes = append(codes, "amount_over_cap")
		messages = append(messages, fmt.Sprintf("total %s exceeds cap %s", total.FloatString(4), capAmt.FloatString(4)))
	}

	if !rules.AllowAutonomous {
		// autonomous flag is enforced by API HITL; keep code available
	}

	return unique(codes), messages
}

func asString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case json.Number:
		return t.String()
	case float64:
		return fmt.Sprintf("%g", t)
	default:
		return fmt.Sprintf("%v", v)
	}
}

func asInt(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case json.Number:
		i, _ := t.Int64()
		return int(i)
	case int:
		return t
	default:
		return 0
	}
}

func parseAmount(s string) (*big.Rat, error) {
	s = strings.TrimSpace(s)
	r := new(big.Rat)
	if _, ok := r.SetString(s); !ok {
		return nil, fmt.Errorf("bad amount")
	}
	return r, nil
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}

func setOf(list []string) map[string]bool {
	out := make(map[string]bool, len(list))
	for _, x := range list {
		out[x] = true
	}
	return out
}

func unique(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, c := range in {
		if !seen[c] {
			seen[c] = true
			out = append(out, c)
		}
	}
	return out
}
