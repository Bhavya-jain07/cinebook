/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg: "#0b0b0d",
          surface: "#151417",
          surfaceLight: "#1e1c21",
          border: "#2b282f",
          red: "#e11d48",
          redDark: "#9f1239",
          gold: "#f5c451",
          text: "#f2f0f4",
          muted: "#8b8792",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Bebas Neue", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
