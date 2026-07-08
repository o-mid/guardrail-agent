package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

func main() {
	port := env("PORT", "8090")
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
		writeJSON(w, http.StatusNotImplemented, map[string]any{
			"ok":            false,
			"schemaErrors":  []string{"not_implemented"},
			"policyCodes":   []string{},
			"humanMessages": []string{"validate endpoint not wired yet"},
		})
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
