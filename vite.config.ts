import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Shims process.env for compatibility with the SDK requirements
    // Use an empty string fallback to prevent build crashes if the env var isn't set yet
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Smaller build size
    minify: 'esbuild',
  },
  server: {
    port: 3000,
  }
});