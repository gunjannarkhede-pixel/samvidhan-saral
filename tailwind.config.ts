import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#191c21',
        navy: '#101c33',
        navysoft: '#1c2e4d',
        paper: '#f7f5f0',
        raised: '#fffefb',
        rule: '#ddd6c8',
        brass: '#9a7b34',
        brasssoft: '#c8a961',
        inksoft: '#4a5160',
        saffron: '#e07a1f',
        indigo2: '#101c33',
        // The older pages were written against Tailwind's cool slate palette.
        // Remapping slate onto the paper/ink family gives the whole app one
        // identity without rewriting every page.
        slate: {
          50: '#f3f0e9', 100: '#eae5da', 200: '#ddd6c8', 300: '#cfc7b6', 400: '#a9a294',
          500: '#7d7768', 600: '#5c5c60', 700: '#3f434c', 800: '#282d36', 900: '#1b1f26',
        },
        leaf: '#166534',
        indigo: {
          900: '#0a1224', 800: '#152440', 700: '#20355c',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans',
               'Noto Sans Devanagari', 'Nirmala UI', 'Mangal', 'sans-serif'],
        serif: ['Georgia', 'Noto Serif', 'Noto Serif Devanagari', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
