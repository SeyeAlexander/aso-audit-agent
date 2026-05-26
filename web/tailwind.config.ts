import type { Config } from "tailwindcss";

export default {
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#B5FF6B",
          soft: "#D8FFAA",
          dim: "#7FB94A"
        },
        surface: "#0E0F11",
        panel: "#17181B",
        elevated: "#1E2024",
        border: "#26282C",
        muted: "#9A9BA0",
        ink: "#F5F6F7",
        danger: "#FF6B6B",
        warning: "#FFD166"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px"
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
