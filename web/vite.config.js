import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true
      },
      '/srs/api/v1': {
        target: 'http://127.0.0.1:1985',
        rewrite: (path) => path.replace(/^\/srs/, ''),
        changeOrigin: true
      },
      '/live': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/__defaultApp__': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/replays': {
        target: 'http://127.0.0.1:8080', // In dev, we might serve this differently if not relying on nginx/data. Let's redirect to local path or use simple HTTP server in future if needed.
        changeOrigin: true
      }
    }
  }
})
