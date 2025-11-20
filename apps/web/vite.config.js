import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('📤 Proxying:', req.method, req.url, '→ http://localhost:5000' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 Response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    outDir: 'build',
  },
});