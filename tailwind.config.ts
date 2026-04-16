import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        fraunces: ["Fraunces", "serif"],
        "dm-sans": ["DM Sans", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#f0f9f4",
          100: "#d9f0e4",
          200: "#b2e0c8",
          300: "#7fcaaa",
          400: "#4daf8a",
          500: "#2d9470",
          600: "#217558",
          700: "#1c5e47",
          800: "#194b3a",
          900: "#163e31",
        },
      },
    },
  },
  plugins: [],
};

export default config;
