import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimize JSX runtime
      jsxRuntime: 'automatic',
    }),
    // Bundle analyzer - only in analyze mode
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // Better visualization
    })] : []),
  ],
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
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info'] : [],
        passes: 2, // Multiple passes for better compression
      },
      mangle: {
        safari10: true, // Safari 10 compatibility
      },
      format: {
        comments: false, // Remove comments
      },
    },
    rollupOptions: {
      output: {
        // Enhanced manual chunks for better code splitting
        manualChunks: (id) => {
          // Vendor chunks - Core React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }

          // Router and navigation
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }

          // Data fetching and state management
          if (id.includes('node_modules/@tanstack/react-query') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/axios')) {
            return 'data-layer';
          }

          // UI and animation libraries
          if (id.includes('node_modules/framer-motion') ||
            id.includes('node_modules/lucide-react') ||
            id.includes('node_modules/@mui')) {
            return 'ui-libs';
          }

          // Charts and visualization
          if (id.includes('node_modules/recharts') ||
            id.includes('node_modules/@tanstack/react-table') ||
            id.includes('node_modules/@tanstack/react-virtual')) {
            return 'data-viz';
          }

          // Form handling
          if (id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/@hookform') ||
            id.includes('node_modules/zod') ||
            id.includes('node_modules/yup') ||
            id.includes('node_modules/formik')) {
            return 'forms';
          }

          // Date and utility libraries
          if (id.includes('node_modules/date-fns') ||
            id.includes('node_modules/dayjs') ||
            id.includes('node_modules/dompurify')) {
            return 'utils';
          }

          // Payment processing
          if (id.includes('node_modules/@stripe')) {
            return 'payments';
          }

          // Socket and real-time
          if (id.includes('node_modules/socket.io')) {
            return 'realtime';
          }

          // Performance monitoring
          if (id.includes('node_modules/web-vitals')) {
            return 'monitoring';
          }

          // Other vendor libraries
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
        // Optimize chunk file names
        chunkFileNames: (_chunkInfo) => {
          return `assets/[name]-[hash].js`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || 'asset';
          const info = name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(name)) {
            return `assets/images/[name]-[hash].${ext}`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
            return `assets/fonts/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
      },
      // Tree shaking configuration
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
    },
    chunkSizeWarningLimit: 800, // Smaller chunks for better loading
    reportCompressedSize: true,
    // Enable source maps for production debugging (optional)
    sourcemap: process.env.NODE_ENV !== 'production',
    // Optimize CSS
    cssCodeSplit: true,
    cssMinify: true,
  },
  optimizeDeps: {
    include: [
      // Core dependencies that should be pre-bundled
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'zustand',
      'axios',
      'date-fns',
      'dayjs',
      'dompurify',
      'react-hook-form',
      'zod',
      'web-vitals',
      // Date pickers and adapters
      '@mui/x-date-pickers',
      '@mui/x-date-pickers/AdapterDayjs',
      '@mui/x-date-pickers/LocalizationProvider',
      '@mui/x-date-pickers/DatePicker',
    ],
    exclude: [
      // Large libraries that benefit from dynamic imports
      'lucide-react',
      'recharts',
      'framer-motion',
    ],
    // Force optimization of problematic dependencies
    force: true,
  },
  // Resolve configuration for better module resolution
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  // Enable better error handling and chunk loading
  define: {
    // Enable chunk retry mechanisms in production
    __CHUNK_RETRY_ENABLED__: 'true',
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '2.1.1'),
  },
});
