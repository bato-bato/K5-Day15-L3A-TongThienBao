import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const proxy = { '/api': 'http://127.0.0.1:8000' };
const frontend = fileURLToPath(new URL('.', import.meta.url));
const labData = fileURLToPath(new URL('../../data/lab-mapping/', import.meta.url));

export default defineConfig({
  server: { proxy, fs: { allow: [frontend, labData] } },
  preview: { proxy },
});
