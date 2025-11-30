import { defineConfig } from 'vite';
import inject from '@rollup/plugin-inject';
import path from 'path';

export default defineConfig({
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
  },
  server: {
    open: true,
  },
});
