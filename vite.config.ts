import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licences } from './scripts/licences/plugin.js';
import { network } from './scripts/network/plugin.js';
// #49: records and F5 exports name the build's version, read here so package.json never ships.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
export default defineConfig({ plugins: [react(), licences(), network()], assetsInclude: ['**/*.wasm'], define: { __APP_VERSION__: JSON.stringify(version) } });
