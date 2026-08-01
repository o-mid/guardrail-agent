package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/o-mid/guardrail-agent/services/policy/internal/validate"
)

func main() {
	port := env("PORT", "8090")
	schemaPath := env("PLAN_SCHEMA_PATH", "internal/schema/plan.schema.json")
	schemaBytes, err := os.ReadFile(schemaPath)
	if err != nil {
		log.Fatalf("read schema: %v", err)
	}
	schemaValidator, err := validate.NewSchemaValidator(schemaBytes)
	if err != nil {
		log.Fatalf("compile schema: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, _ *http.Request) {
		path := env("POLICY_DEFAULTS_PATH", "/config/default-policy.json")
		if _, err := os.Stat(path); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": "config missing"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/v1/validate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req validate.ValidateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, validate.ValidateResponse{
				OK:           false,
				SchemaErrors: []string{"invalid_json"},
			})
			return
		}
		schemaErrors := schemaValidator.Validate(req.Plan)
		policyCodes := []string{}
		human := []string{}
		if len(schemaErrors) == 0 {
			policyCodes, human = validate.CheckPolicy(req.Plan, req.Policy)
		} else {
			human = append(human, "plan failed schema validation")
		}
		if schemaErrors == nil {
			schemaErrors = []string{}
		}
		if policyCodes == nil {
			policyCodes = []string{}
		}
		if human == nil {
			human = []string{}
		}
		resp := validate.ValidateResponse{
			OK:            len(schemaErrors) == 0 && len(policyCodes) == 0,
			SchemaErrors:  schemaErrors,
			PolicyCodes:   policyCodes,
			HumanMessages: human,
		}
		writeJSON(w, http.StatusOK, resp)
	})

	addr := ":" + port
	log.Printf("policy listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
