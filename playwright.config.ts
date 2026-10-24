import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/e2e', fullyParallel: true,
  // Specs run whole Playthroughs and analysis (30 s app deadline); a busy machine slows them 3–7×,
  // so give headroom instead of retries, which would hide real flakes.
  timeout: 60_000, expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium' },
  projects: [320, 390, 600, 1440].flatMap(width => (['light', 'dark'] as const).map(colorScheme => ({
    name: `${width}-${colorScheme}`, use: { viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 }, colorScheme },
  }))),
  webServer: { command: 'npx vite build --mode audit && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
