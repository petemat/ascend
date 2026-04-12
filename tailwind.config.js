/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: {
          950: "#050508",
          900: "#0b0b11",
          850: "#10101a",
          800: "#141424",
          700: "#1a1a2c",
        },
        gold: {
          50: "#fff7e6",
          200: "#f7d38b",
          300: "#f1c35d",
          400: "#e8b23b",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(241,195,93,0.18), 0 0 24px rgba(241,195,93,0.10)",
        card: "0 10px 30px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        "gold-radial": "radial-gradient(60% 60% at 50% 40%, rgba(241,195,93,0.22) 0%, rgba(241,195,93,0.10) 35%, rgba(0,0,0,0) 70%)",
      },
    },
  },
  plugins: [],
};

