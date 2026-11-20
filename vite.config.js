import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Clean production build for GitHub Pages without master profile banner
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets load cleanly on GitHub Pages and any subpath
})
