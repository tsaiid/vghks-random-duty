import { defineConfig } from 'vite';
import inject from '@rollup/plugin-inject';
import path from 'path';
import { version } from './package.json';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/random-duty/' : './',
  define: {
    '__APP_VERSION__': JSON.stringify(version),
  },
  plugins: [
    inject({
      include: '**/*.js',
      $: 'jquery',
      jQuery: 'jquery',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'jquery-contenteditable': path.resolve(__dirname, 'node_modules/jquery-contenteditable/jquery.contenteditable.js'),
      moment: path.resolve(__dirname, 'node_modules/moment/moment.js'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jquery-ui')) {
              return 'jquery-ui';
            }
            if (id.includes('fullcalendar') || id.includes('moment')) {
              return 'calendar';
            }
            if (id.includes('bootstrap')) {
              return 'bootstrap';
            }
            if (id.includes('html2canvas')) {
              return 'html2canvas';
            }
            if (id.includes('crypto-js')) {
              return 'crypto';
            }
            // Match exactly 'jquery' package, avoiding jquery-plugins
            if (id.includes('/node_modules/jquery/')) {
              return 'jquery';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    open: true,
  },
}));
