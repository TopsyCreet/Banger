import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Banger/',
  build: {
    outDir: 'docs',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
