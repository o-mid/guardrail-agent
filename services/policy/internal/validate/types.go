package validate

type Rules struct {
	MaxSteps              int                 `json:"maxSteps"`
	MaxAmount             string              `json:"maxAmount"`
	Chains                []string            `json:"chains"`
	Actions               map[string][]string `json:"actions"`
	AllowRecipients       map[string][]string `json:"allowRecipients"`
	AllowTokens           map[string][]string `json:"allowTokens"`
	MaxSlippageBps        int                 `json:"maxSlippageBps"`
	ForbidInfiniteApprove bool                `json:"forbidInfiniteApprove"`
	AllowAutonomous       bool                `json:"allowAutonomous"`
}

type PolicyDoc struct {
	Version int   `json:"version"`
	Rules   Rules `json:"rules"`
}

type CheckContext struct {
	AgentWindow       string   `json:"agentWindow"`
	RecipientWindow   string   `json:"recipientWindow"`
	WindowCap         string   `json:"windowCap"`
	InvoiceID         string   `json:"invoiceId"`
	PaidInvoices      []string `json:"paidInvoices"`
	ExpectedRecipient string   `json:"expectedRecipient"`
	ExpectedToken     string   `json:"expectedToken"`
	ExpectedChain     string   `json:"expectedChain"`
	ExpectedAmount    string   `json:"expectedAmount"`
	PriorTurn         string   `json:"priorTurn"`
}

type ValidateRequest struct {
	Plan    any          `json:"plan"`
	Policy  PolicyDoc    `json:"policy"`
	Context CheckContext `json:"context"`
}

type ValidateResponse struct {
	OK            bool     `json:"ok"`
	SchemaErrors  []string `json:"schemaErrors"`
	PolicyCodes   []string `json:"policyCodes"`
	HumanMessages []string `json:"humanMessages"`
}
