package validate

import (
	"encoding/json"
	"fmt"
	"math/big"
	"regexp"
	"strings"
)

var instructionRE = regexp.MustCompile(`(?i)(ignore previous|disregard previous|system prompt|send the funds|send the payment|send it to)`)
var hexBlobRE = regexp.MustCompile(`(?i)0x[0-9a-f]{41,}`)

func CheckPolicy(plan any, policy PolicyDoc) (codes []string, messages []string) {
	return CheckPolicyContext(plan, policy, CheckContext{})
}

func CheckPolicyContext(plan any, policy PolicyDoc, ctx CheckContext) (codes []string, messages []string) {
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
	recipientList := rules.AllowRecipients[chain]
	allowedRecipients := setOf(recipientList)
	total := new(big.Rat)
	capAmt, capErr := parseAmount(rules.MaxAmount)
	if capErr != nil {
		capAmt = big.NewRat(100, 1)
	}
	deviated := false
	if ctx.ExpectedChain != "" && !strings.EqualFold(chain, ctx.ExpectedChain) {
		codes = append(codes, "wrong_chain")
		messages = append(messages, fmt.Sprintf("chain %s is not the task chain %s", chain, ctx.ExpectedChain))
		deviated = true
	}
	summary := asString(m["summary"])
	if instructionRE.MatchString(summary) {
		codes = append(codes, "memo_smuggle")
		messages = append(messages, "summary contains payment instructions")
	}
	if hexBlobRE.MatchString(summary) {
		codes = append(codes, "hex_smuggle")
		messages = append(messages, "summary contains a hex blob")
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
			amount := asString(step["amount"])
			if rules.ForbidInfiniteApprove && isInfiniteApprove(amount) {
				codes = append(codes, "infinite_approve")
				messages = append(messages, fmt.Sprintf("step %d infinite ERC-20 approve is forbidden", i))
			}
			if amt, err := parseAmount(amount); err == nil {
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
			to := asString(step["to"])
			if len(allowedRecipients) > 0 && !allowedRecipients[to] && !strings.EqualFold(to, "self") {
				codes = append(codes, "recipient_not_allowed")
				messages = append(messages, fmt.Sprintf("step %d recipient %s not allowlisted", i, to))
			}
			if amt, err := parseAmount(asString(step["amount"])); err == nil {
				total.Add(total, amt)
			}
			if isLookalike(to, recipientList) {
				codes = append(codes, "lookalike_recipient")
				messages = append(messages, fmt.Sprintf("step %d recipient %s resembles an allowlisted address", i, to))
			}
			if ctx.ExpectedRecipient != "" && to != "" && !strings.EqualFold(to, ctx.ExpectedRecipient) && !strings.EqualFold(to, "self") {
				codes = append(codes, "recipient_swap")
				messages = append(messages, fmt.Sprintf("step %d recipient %s is not the task recipient", i, to))
				deviated = true
			}
		}

		token := tokenOf(step)
		if ctx.ExpectedToken != "" && token != "" && !strings.EqualFold(token, ctx.ExpectedToken) {
			codes = append(codes, "wrong_token")
			messages = append(messages, fmt.Sprintf("step %d token %s is not the task token %s", i, token, ctx.ExpectedToken))
			deviated = true
		}
		amtStr := amountOf(step)
		if ctx.ExpectedAmount != "" && amtStr != "" && !amountsEqual(amtStr, ctx.ExpectedAmount) {
			codes = append(codes, "amount_mismatch")
			messages = append(messages, fmt.Sprintf("step %d amount %s is not the task amount %s", i, amtStr, ctx.ExpectedAmount))
			deviated = true
		}
		memo := asString(step["memo"])
		if instructionRE.MatchString(memo) {
			codes = append(codes, "memo_smuggle")
			messages = append(messages, fmt.Sprintf("step %d memo contains payment instructions", i))
		}
		if hexBlobRE.MatchString(memo) {
			codes = append(codes, "hex_smuggle")
			messages = append(messages, fmt.Sprintf("step %d memo contains a hex blob", i))
		}
		invoice := asString(step["invoiceId"])
		if invoice != "" && invoicePaid(invoice, ctx.PaidInvoices) {
			codes = append(codes, "duplicate_invoice")
			messages = append(messages, fmt.Sprintf("step %d invoice %s was already paid", i, invoice))
		}
	}

	if total.Cmp(capAmt) > 0 {
		codes = append(codes, "amount_over_cap")
		messages = append(messages, fmt.Sprintf("total %s exceeds cap %s", total.FloatString(4), capAmt.FloatString(4)))
	}

	windowCap := capAmt
	if ctx.WindowCap != "" {
		if parsed, err := parseAmount(ctx.WindowCap); err == nil {
			windowCap = parsed
		}
	}
	if overWindow(ctx.AgentWindow, total, windowCap) || overWindow(ctx.RecipientWindow, total, windowCap) {
		codes = append(codes, "spend_window_exceeded")
		messages = append(messages, fmt.Sprintf("rolling spend plus %s exceeds window cap %s", total.FloatString(4), windowCap.FloatString(4)))
	}
	if ctx.InvoiceID != "" && invoicePaid(ctx.InvoiceID, ctx.PaidInvoices) {
		codes = append(codes, "duplicate_invoice")
		messages = append(messages, fmt.Sprintf("invoice %s was already paid", ctx.InvoiceID))
	}
	if ctx.PriorTurn != "" && instructionRE.MatchString(ctx.PriorTurn) && deviated {
		codes = append(codes, "delayed_instruction")
		messages = append(messages, "an earlier turn changed the payment")
	}

	if !rules.AllowAutonomous {
		// autonomous flag is enforced by API HITL; keep code available
	}

	return unique(codes), messages
}

func tokenOf(step map[string]any) string {
	token := asString(step["token"])
	if token == "" {
		token = asString(step["tokenIn"])
	}
	if token == "" {
		token = asString(step["mint"])
	}
	return token
}

func amountOf(step map[string]any) string {
	amt := asString(step["amount"])
	if amt == "" {
		amt = asString(step["amountIn"])
	}
	return amt
}

func amountsEqual(a, b string) bool {
	ra, ea := parseAmount(a)
	rb, eb := parseAmount(b)
	if ea != nil || eb != nil {
		return false
	}
	return ra.Cmp(rb) == 0
}

func overWindow(already string, this *big.Rat, cap *big.Rat) bool {
	if strings.TrimSpace(already) == "" {
		return false
	}
	prev, err := parseAmount(already)
	if err != nil {
		return false
	}
	sum := new(big.Rat).Add(prev, this)
	return sum.Cmp(cap) > 0
}

func invoicePaid(id string, paid []string) bool {
	for _, item := range paid {
		if strings.EqualFold(strings.TrimSpace(item), strings.TrimSpace(id)) {
			return true
		}
	}
	return false
}

func isLookalike(to string, allow []string) bool {
	if to == "" || strings.EqualFold(to, "self") || contains(allow, to) {
		return false
	}
	for _, candidate := range allow {
		if sameEnds(to, candidate) {
			return true
		}
	}
	return false
}

func sameEnds(a, b string) bool {
	as := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(a), "0x"))
	bs := strings.ToLower(strings.TrimPrefix(strings.TrimSpace(b), "0x"))
	if len(as) < 8 || len(as) != len(bs) || as == bs {
		return false
	}
	return as[:4] == bs[:4] && as[len(as)-4:] == bs[len(bs)-4:]
}

func asString(v any) string {
	if v == nil {
		return ""
	}
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

func isInfiniteApprove(amount string) bool {
	s := strings.TrimSpace(strings.ToLower(amount))
	if s == "unlimited" || s == "max" || s == "infinite" {
		return true
	}
	// common max-uint patterns as decimal strings
	if strings.HasPrefix(s, "115792089237316195423570985008687907853269984665640564039457") {
		return true
	}
	r, err := parseAmount(s)
	if err != nil {
		return false
	}
	// treat anything >= 1e30 as infinite for mock units
	threshold := new(big.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(30), nil))
	return r.Cmp(threshold) >= 0
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
