/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
      // Cores do Shopping 25 (azul-marinho do logo). O código usa "emerald" igual ao Indufarma.
      colors: {
        emerald: {
          50: "#eef3fb", 100: "#d9e3f5", 200: "#b6c8ea", 300: "#87a4d9", 400: "#577dc4", 500: "#3760ac",
          600: "#264c93", 700: "#1d3d7a", 800: "#173265", 900: "#102650", 950: "#0a1833",
        },
      },
    },
  },
  plugins: [],
};
