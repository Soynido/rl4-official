import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        rl4: {
          dark: '#181625',
          darker: '#0D1117',
          violet: '#8920FE',
          magenta: '#BB2CFF',
          turquoise: '#16F7B5',
          light: '#EEF2FB',
        },
      },
      boxShadow: {
        glow: '0 0 12px #8920FE',
        glowHover: '0 0 18px #16F7B5',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;

