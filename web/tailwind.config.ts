import type { Config } from "tailwindcss";

/**
 * Theme tokens live in CSS variables (globals.css) so the same Tailwind class
 * works in both light and dark mode. The lime accent (`logo`) is the only
 * brand-color literal — everything else is a semantic token.
 */
export default {
  darkMode: ["selector", "[data-theme=\"dark\"]"],
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        sunken: "rgb(var(--sunken) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        logo: "rgb(var(--logo) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-ink": "rgb(var(--primary-ink) / <alpha-value>)",
        "accent-green": "rgb(var(--accent-green) / <alpha-value>)",
        "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "danger-ink": "rgb(var(--danger-ink) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)"
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"]
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "12px",
        xl: "16px"
      },
      boxShadow: {
        card: "0 1px 0 rgb(var(--ink) / 0.04), 0 8px 24px rgb(0 0 0 / 0.06)",
        "card-dark": "0 1px 0 rgb(255 255 255 / 0.04), 0 8px 24px rgb(0 0 0 / 0.4)"
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  },
  plugins: []
} satisfies Config;
