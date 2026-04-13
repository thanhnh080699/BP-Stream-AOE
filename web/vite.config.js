import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file from parent directory
  const env = loadEnv(mode, '../', '');

  return {
    plugins: [react()],
    envDir: '../', // Also make env available in client via VITE_ prefix if needed
    server: {
      proxy: {
        '/api/v1': {
          target: env.API_URL || 'http://127.0.0.1:5001',
          changeOrigin: true
        },
        '/srs/api/v1': {
          target: env.SRS_URL || 'http://127.0.0.1:1985',
          rewrite: (path) => path.replace(/^\/srs/, ''),
          changeOrigin: true
        },
        '/live': {
          target: env.HTTP_SERVER_URL || 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/__defaultApp__': {
          target: env.HTTP_SERVER_URL || 'http://127.0.0.1:8080',
          changeOrigin: true
        },
        '/replays': {
          target: env.HTTP_SERVER_URL || 'http://127.0.0.1:8080',
          changeOrigin: true
        }
      }
    }
  }
})
