import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During development the new frontend runs on port 5173 and passes every /api call
// to the Aegis backend on port 4100, so the browser sees one site and login cookies work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:4100' },
  },
})
