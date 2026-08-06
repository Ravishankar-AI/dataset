import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-alt": "var(--paper-alt)",
        card: "var(--card)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        "ink-faint": "var(--ink-faint)",
        signal: "var(--signal)",
        "signal-ink": "var(--signal-ink)",
        "signal-soft": "var(--signal-soft)",
        "on-signal": "var(--on-signal)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
      },
      fontFamily: {
        display: "var(--font-display)",
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        pill: "999px",
      },
      boxShadow: {
        // Hard, non-blurred offset shadow — matches objectways.com's
        // .btn-primary/.btn-arrow button treatment.
        brand: "0 3px 0 0 var(--line-strong)",
      },
    },
  },
  plugins: [],
};

export default config;
