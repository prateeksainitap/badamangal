import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        saffron: { 50: "#FFF6EE", 500: "#F2944C", 600: "#E07A1F" },
        sindoor: { 700: "#9C2A2A" },
        gold:    { 100: "#F5EAC9", 500: "#C9A24A" },
        ink:     { 600: "#5A4F46", 900: "#1A1410" },
        cream:   { 50: "#FBF7F0" },
        leaf:    { 600: "#3F7A3F" },
        alert:   { 500: "#C44A2C" },
      },
      fontFamily: {
        tiro:      ["var(--font-tiro)", "serif"],
        fraunces:  ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        mukta:     ["var(--font-mukta)", "ui-sans-serif", "system-ui", "sans-serif"],
        cormorant: ["var(--font-cormorant)", "serif"],
        deva:      ["var(--font-noto-deva)", "var(--font-mukta)", "sans-serif"],
        // Display sans for big numerals (countdown, stats, visitor counter).
        numerals:  ["var(--font-numerals)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Editorial scale per design-system-v2 §2
        "h1":        ["3.5rem",  { lineHeight: "1.05", letterSpacing: "0.01em" }],
        "h1-lg":     ["5rem",    { lineHeight: "1.02", letterSpacing: "0.005em" }],
        "h2":        ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.005em" }],
        "h2-lg":     ["2.75rem", { lineHeight: "1.1",  letterSpacing: "-0.005em" }],
        "drop-cap":  ["6rem",    { lineHeight: "0.85" }],
        "body":      ["1.0625rem", { lineHeight: "1.7" }],
        "body-hi":   ["1.125rem",  { lineHeight: "1.7" }],
        "caption":   ["0.8125rem", { lineHeight: "1.2", letterSpacing: "0.5em" }],
        "pull":      ["1.75rem", { lineHeight: "1.35", letterSpacing: "-0.005em" }],
        "pull-lg":   ["2.125rem", { lineHeight: "1.3" }],
      },
      boxShadow: {
        warm: [
          "0 1px 0 rgba(201,162,74,0.15)",
          "0 8px 24px -8px rgba(156,42,42,0.10)",
          "0 24px 48px -24px rgba(26,20,16,0.12)",
        ].join(", "),
      },
      keyframes: {
        "fade-greeting": {
          "0%":   { opacity: "0", transform: "translateY(-8px)" },
          "20%":  { opacity: "1", transform: "translateY(0)" },
          "80%":  { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-8px)" },
        },
        marquee: {
          "0%":   { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-greeting": "fade-greeting 1.2s ease both",
        "marquee-slow":  "marquee 80s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
