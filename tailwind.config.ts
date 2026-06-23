import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // reservation states
        reserved: "#2e6e4e",
        tentative: "#d9a23b",
        free: "#cfe8d8",
      },
    },
  },
  plugins: [],
};

export default config;
