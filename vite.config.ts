import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licences } from './scripts/licences/plugin.js';
import { localeFonts } from './scripts/fonts/plugin.js';
import { localeSignOff } from './scripts/content/plugin.js';
import { network } from './scripts/network/plugin.js';
// #49: records and F5 exports name the build's version, read here so package.json never ships.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// I-12, I18N-11.1: shipped-locales.json stays offline; Vite injects the array like __APP_VERSION__.
const shippedLocales = JSON.parse(readFileSync(new URL('./scripts/content/shipped-locales.json', import.meta.url), 'utf8')) as string[];
export default defineConfig({
  plugins: [react(), localeSignOff(), localeFonts(), licences(), network()],
  assetsInclude: ['**/*.wasm'],
  // Limit dev dependency scanning to the app entry, skipping the static 5.8 MB design gallery under docs/design/.
  optimizeDeps: { entries: ['index.html'] },
  define: { __APP_VERSION__: JSON.stringify(version), __SHIPPED_LOCALES__: JSON.stringify(shippedLocales) },
});
