import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // F1 app colour palette (see PRD §Visual Design)
        background: "#0f0f0f",
        surface: "#1a1a24",
        "surface-hover": "#22223a",
        accent: {
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          muted: "#4c1d95",
        },
        muted: "#6b7280",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
