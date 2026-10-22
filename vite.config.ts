import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licences } from './scripts/licences/plugin.js';
import { network } from './scripts/network/plugin.js';
export default defineConfig({ plugins: [react(), licences(), network()], assetsInclude: ['**/*.wasm'] });
