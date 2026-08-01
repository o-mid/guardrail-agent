import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        surface: "var(--surface)",
        canvas: "var(--canvas)",
        "canvas-subtle": "var(--canvas-subtle)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        danger: "var(--danger)",
        "danger-bg": "var(--danger-bg)",
        line: "var(--line)",
        focus: "var(--focus)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        focus: "0 0 0 2px var(--surface), 0 0 0 4px var(--focus)",
      },
      keyframes: {
        "mark-fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "reject-enter": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "status-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "mark-fade-in": "mark-fade-in 0.6s ease-out forwards",
        "reject-enter": "reject-enter 0.35s ease-out forwards",
        "status-pulse": "status-pulse 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
