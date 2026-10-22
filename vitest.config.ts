import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
export default defineConfig({ plugins: [react()], assetsInclude: ['**/*.wasm'], define: { __APP_VERSION__: JSON.stringify(version) }, test: { projects: [
  { extends: true, test: { name: 'node', environment: 'node', include: ['src/**/*.test.{ts,tsx}', 'test/*.test.ts'], exclude: ['**/*.browser.test.*'] } },
  { extends: true, test: { name: 'browser', include: ['src/table/**/*.test.ts', 'src/app/**/*.browser.test.tsx'], browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] } } },
] } });
