import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
const base = process.env.BASE_URL ?? '/'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
