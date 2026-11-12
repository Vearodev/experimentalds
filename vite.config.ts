import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { cloudApiPlugin } from './apps/cloud/server.ts';

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  return {
    root: resolve(import.meta.dirname, 'apps/playground'),
    // Relative URLs work at /, /repository/ and on a custom domain without rebuilding.
    base: pages ? './' : '/',
    plugins: [
      react(),
      pages
        ? {
            name: 'basis-static-demo',
            transformIndexHtml() {
              return [
                {
                  tag: 'meta',
                  attrs: { name: 'basis-demo-transport', content: 'embedded' },
                  injectTo: 'head' as const,
                },
              ];
            },
          }
        : cloudApiPlugin(resolve(import.meta.dirname, '.local/cloud-demo.json')),
    ],
    server: { watch: { awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } } },
    build: {
      outDir: resolve(import.meta.dirname, pages ? 'dist-pages' : 'dist'),
      emptyOutDir: true,
    },
  };
});
