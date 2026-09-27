import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  server: { port: 5199, strictPort: true },
  build: { target: 'es2022' },
});
