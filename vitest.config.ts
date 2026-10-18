import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
export default defineConfig({ plugins: [react()], test: { projects: [
  { extends: true, test: { name: 'node', environment: 'node', include: ['src/**/*.test.{ts,tsx}', 'test/*.test.ts'], exclude: ['**/*.browser.test.*'] } },
  { extends: true, test: { name: 'browser', include: ['src/table/**/*.test.ts', 'src/app/**/*.browser.test.tsx'], browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] } } },
] } });
