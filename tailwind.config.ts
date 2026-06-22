import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Geist Sans"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        display: ['"Geist Sans"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        body: ['"Geist Sans"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"Geist Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
        numeric: ['"Geist Sans"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.5" }],
        sm: ["0.8125rem", { lineHeight: "1.5" }],
        base: ["0.9375rem", { lineHeight: "1.6" }],
        lg: ["1.0625rem", { lineHeight: "1.5" }],
        xl: ["1.25rem", { lineHeight: "1.35" }],
        "2xl": ["1.5rem", { lineHeight: "1.2" }],
        "3xl": ["1.875rem", { lineHeight: "1.12" }],
        "4xl": ["2.25rem", { lineHeight: "1.06" }],
        "5xl": ["3rem", { lineHeight: "1" }],
        label: ["0.6875rem", { lineHeight: "1.25", letterSpacing: "0.12em" }],
        caption: ["0.6875rem", { lineHeight: "1.45", letterSpacing: "0" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--surface-foreground))",
        },
        intelligence: {
          amber: "#d4a444",
          gold: "#e8b856",
          ink: "#f0ebe0",
          cyan: "#42aed0",
          green: "#38a866",
          red: "#d45555",
        },
        deal: {
          green: "hsl(var(--deal-green))",
          "green-foreground": "hsl(var(--deal-green-foreground))",
          amber: "hsl(var(--deal-amber))",
          "amber-foreground": "hsl(var(--deal-amber-foreground))",
          red: "hsl(var(--deal-red))",
          "red-foreground": "hsl(var(--deal-red-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        console: "0 1px 0 rgba(255,255,255,0.02), 0 8px 24px rgba(0,0,0,0.45)",
        "console-soft": "0 1px 0 rgba(255,255,255,0.02), 0 4px 14px rgba(0,0,0,0.35)",
        "gold-glow": "0 0 24px rgba(212,164,68,0.15)",
        "gold-glow-lg": "0 0 48px rgba(212,164,68,0.2)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "motion-rise": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "motion-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scroll-hint": {
          "0%, 100%": { opacity: "0.3", transform: "translateY(0)" },
          "50%": { opacity: "0.8", transform: "translateY(5px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translate3d(0, 12px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "motion-rise": "motion-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "motion-fade": "motion-fade 0.5s ease both",
        "fade-up": "fade-up var(--duration-slow) var(--ease-out) both",
        "fade-in": "fade-in var(--duration-base) var(--ease-out) both",
        "scroll-hint": "scroll-hint 2.4s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
