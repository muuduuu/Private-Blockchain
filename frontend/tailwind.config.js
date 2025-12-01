import tailwindcssAnimate from "tailwindcss-animate"

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#3B82F6",
          foreground: "#E2E8F0",
        },
        success: {
          DEFAULT: "#10B981",
          foreground: "#ECFDF5",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#EF4444",
          foreground: "#FEE2E2",
        },
        surface: {
          light: "#F8FAFC",
          dark: "#0F172A",
        },
      },
      borderRadius: {
        lg: "0.65rem",
        md: "0.5rem",
        sm: "0.35rem",
      },
      boxShadow: {
        card: "0 15px 35px rgba(15, 23, 42, 0.15)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.45 },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config

