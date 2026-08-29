import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@templates': path.resolve(__dirname, '../../templates'),
      '@Master': path.resolve(__dirname, '../../Master')
    }
  },
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari14'
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    fs: {
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        timeout: 60000,
        proxyTimeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            if (res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json',
              });
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Backend server starting up or connection refused: ' + err.message,
                code: 'BACKEND_UNAVAILABLE'
              }));
            }
          });
        }
      }
    }
  }
})
