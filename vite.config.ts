import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licences } from './scripts/licences/plugin.js';
export default defineConfig({ plugins: [react(), licences()], assetsInclude: ['**/*.wasm'] });
