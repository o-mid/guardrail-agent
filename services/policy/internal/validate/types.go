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

type ValidateRequest struct {
	Plan   any       `json:"plan"`
	Policy PolicyDoc `json:"policy"`
}

type ValidateResponse struct {
	OK            bool     `json:"ok"`
	SchemaErrors  []string `json:"schemaErrors"`
	PolicyCodes   []string `json:"policyCodes"`
	HumanMessages []string `json:"humanMessages"`
}
