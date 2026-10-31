import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    watch: { usePolling: true }, // necesario para hot reload con volúmenes en Docker Desktop
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:3000', changeOrigin: true } },
  },
});
