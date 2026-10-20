import { defineConfig } from 'vite';
import path from 'path';
import { version } from './package.json';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/random-duty/' : './',
  define: {
    '__APP_VERSION__': JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('html-to-image')) {
              return 'html-to-image';
            }
            if (id.includes('excellentexport')) {
              return 'excellentexport';
            }
            if (id.includes('@fullcalendar')) {
              return 'fullcalendar';
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
