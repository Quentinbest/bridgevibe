import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
export default defineConfig({ plugins: [react()], assetsInclude: ['**/*.wasm'], define: { __APP_VERSION__: JSON.stringify(version) }, test: { projects: [
  // Some node tests start ESLint (type-aware), dependency-cruiser or the solver; a cold start under
  // parallel load can pass 5 s. Headroom, not retries: a hang still fails (as for e2e, #87).
  { extends: true, test: { name: 'node', environment: 'node', testTimeout: 20_000, include: ['src/**/*.test.{ts,tsx}', 'test/*.test.ts'], exclude: ['**/*.browser.test.*'] } },
  { extends: true, test: { name: 'browser', include: ['src/table/**/*.test.ts', 'src/app/**/*.browser.test.tsx'], browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] } } },
] } });
