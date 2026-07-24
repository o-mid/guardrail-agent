import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#152028",
        paper: "#f3efe6",
        accent: "#0f6b5c",
        danger: "#9b2c2c",
        line: "#cfc6b6",
      },
      fontFamily: {
        display: ["\"Iowan Old Style\"", "\"Palatino Linotype\"", "Palatino", "serif"],
        body: ["\"IBM Plex Sans\"", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
