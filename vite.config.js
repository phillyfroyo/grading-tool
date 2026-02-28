import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        account: resolve(__dirname, 'public/account.html'),
      },
      output: {
        // Ensure proper module structure
        format: 'es',
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        }
      }
    },
    // Enable source maps for debugging
    sourcemap: true,
    // Optimize for modern browsers
    target: 'es2020',
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      // Proxy API calls to the backend server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Proxy auth routes to the backend server
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 5000,
        proxyTimeout: 5000
      },
      // Proxy profiles routes to the backend server
      '/profiles': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Proxy format route to the backend server
      '/format': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Proxy account page to the backend server
      '/account': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'public'),
      '@core': resolve(__dirname, 'public/js/core'),
      '@ui': resolve(__dirname, 'public/js/ui'),
      '@essay': resolve(__dirname, 'public/js/essay'),
      '@grading': resolve(__dirname, 'public/js/grading'),
      '@utils': resolve(__dirname, 'public/js/utils')
    }
  },
  optimizeDeps: {
    include: [
      // Pre-bundle common dependencies
      'html2pdf.js'
    ]
  },
  define: {
    // Environment variables
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },
  css: {
    // CSS processing options
    devSourcemap: true
  },
  plugins: [
    // Custom plugin to handle the legacy global modules during transition
    {
      name: 'legacy-globals-bridge',
      configureServer(server) {
        server.middlewares.use('/js', (req, res, next) => {
          // Add headers to help with module loading
          res.setHeader('Cache-Control', 'no-cache');
          next();
        });
      }
    }
  ]
});