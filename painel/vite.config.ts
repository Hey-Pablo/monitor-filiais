import { defineConfig } from 'vite';
export default defineConfig({ root: 'painel', server: { proxy: { '/api': { target: 'http://localhost:3000', rewrite: path => path.replace(/^\/api/, '') } } }, build: { outDir: 'dist', emptyOutDir: true } });
