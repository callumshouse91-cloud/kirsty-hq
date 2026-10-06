import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // single-bundle demo app; SheetJS + Recharts make it ~1.2 MB minified (~380 kB gzipped)
  build: { chunkSizeWarningLimit: 1500 },
})
