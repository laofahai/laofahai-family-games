import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f2ea',
          100: '#efe7d7',
          200: '#e2cfb3',
          300: '#d2b383',
          400: '#c39456',
          500: '#b47a33',
          600: '#956027',
          700: '#764820',
          800: '#553318',
          900: '#35200f',
        },
        melon: {
          50: '#fff2ec',
          100: '#ffe3d3',
          200: '#ffc9a6',
          300: '#ffa572',
          400: '#ff7f3f',
          500: '#ff5e1a',
          600: '#e04607',
          700: '#b13508',
          800: '#7b2409',
          900: '#4a1506',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
