import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages project site: assets MUST be served under /building-vibes/.
  // A build without this base deploys as a blank white page (assets 404).
  base: '/building-vibes/',
  plugins: [react(), tailwindcss()],
})
