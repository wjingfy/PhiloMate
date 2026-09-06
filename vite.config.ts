import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'src/data',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
});
