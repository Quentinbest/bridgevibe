import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// I18N-16: tests don't trim fonts; each locale's font module is empty here (scripts/fonts/plugin.ts builds it).
const localeFontsStub = { name: 'locale-fonts-stub',
  resolveId: (id: string) => id.startsWith('virtual:locale-fonts/') ? `\0${id}` : undefined,
  load: (id: string) => id.startsWith('\0virtual:locale-fonts/') ? 'export {};' : undefined };
export default defineConfig({ plugins: [react(), localeFontsStub], assetsInclude: ['**/*.wasm'], define: { __APP_VERSION__: JSON.stringify(version) }, test: { projects: [
  // Some node tests start ESLint (type-aware), dependency-cruiser or the solver; a cold start under
  // parallel load can pass 5 s. Headroom, not retries: a hang still fails (as for e2e, #87).
  { extends: true, test: { name: 'node', setupFiles: ['./test/setupLocale.ts'], environment: 'node', testTimeout: 20_000, include: ['src/**/*.test.{ts,tsx}', 'test/*.test.ts'], exclude: ['**/*.browser.test.*'] } },
  // #111: bridge-dds is reached only by dynamic import; without prebundling, Vite can discover it
  // mid-run and reload the page under a running test.
  { extends: true, optimizeDeps: { include: ['bridge-dds'] }, test: { name: 'browser', setupFiles: ['./test/setupLocale.ts'], include: ['src/table/**/*.test.ts', 'src/app/**/*.browser.test.tsx'], browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] } } },
] } });
