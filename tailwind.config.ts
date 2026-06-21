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
        display: ['"Archivo Variable"', '"Geist Sans"', "system-ui", "sans-serif"],
        body: ['"Geist Sans"', "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"Geist Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
        numeric: ['"Geist Mono"', '"SFMono-Regular"', "Consolas", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.45" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["0.9375rem", { lineHeight: "1.6" }],
        lg: ["1.0625rem", { lineHeight: "1.55" }],
        xl: ["1.25rem", { lineHeight: "1.35" }],
        "2xl": ["1.5rem", { lineHeight: "1.25" }],
        "3xl": ["1.875rem", { lineHeight: "1.15" }],
        "4xl": ["2.25rem", { lineHeight: "1.08" }],
        label: ["0.6875rem", { lineHeight: "1.25", letterSpacing: "0.1em" }],
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
        console: {
          950: "#050706",
          925: "#080a09",
          900: "#0b0e0d",
          850: "#101312",
          800: "#171b19",
        },
        intelligence: {
          amber: "#e0aa48",
          gold: "#f1c66d",
          ink: "#f6f0e4",
          cyan: "#48b6d6",
          green: "#3fae6e",
          red: "#df5f5f",
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
        console: "0 1px 0 rgba(255,255,255,0.03), 0 10px 30px rgba(0,0,0,0.45)",
        "console-soft": "0 1px 0 rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.35)",
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
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "motion-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scroll-hint": {
          "0%, 100%": { opacity: "0.35", transform: "translateY(0)" },
          "50%": { opacity: "1", transform: "translateY(6px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translate3d(0, 10px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "motion-rise": "motion-rise 0.72s cubic-bezier(0.22, 1, 0.36, 1) both",
        "motion-fade": "motion-fade 0.6s ease both",
        "fade-up": "fade-up var(--duration-slow) var(--ease-out) both",
        "fade-in": "fade-in var(--duration-base) var(--ease-out) both",
        "scroll-hint": "scroll-hint 2.2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
