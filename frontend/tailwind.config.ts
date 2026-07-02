import { defineConfig } from 'tailwindcss';

export default defineConfig({
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
});
