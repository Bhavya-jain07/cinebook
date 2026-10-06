/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Auditorium palette: velvet curtains, ticket paper, marquee bulbs, screen light.
        curtain: "#34101f", // page background
        pit: "#220912", // recessed panels, inputs
        velvet: "#4d1832", // raised surfaces, hover
        paper: "#f3e7cf", // ticket stock, primary text
        dust: "#c9a9b6", // secondary text
        marquee: "#ffb830", // actions, selected seats
        glow: "#9fd8f0", // screen light, live/held states
        coral: "#ff7a6b", // errors
      },
      fontFamily: {
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        flash: {
          "0%": { boxShadow: "0 0 0 0 rgba(159,216,240,.9)", transform: "scale(1.18)" },
          "100%": { boxShadow: "0 0 0 10px rgba(159,216,240,0)", transform: "scale(1)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".35" },
        },
      },
      animation: {
        flash: "flash .9s ease-out",
        rise: "rise .35s ease-out both",
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
