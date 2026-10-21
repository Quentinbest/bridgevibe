import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

// US-45.1: verify the fault selector and wrappers cannot ship in production.
test('production excludes the analysis fault-injection module and URL selector', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-fault-build-'));
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', join(dir, 'bom.json'));
  try {
    const built = await build({ mode: 'production', logLevel: 'silent', build: { outDir: join(dir, 'dist') } });
    if (Array.isArray(built) || !('output' in built)) throw new Error('Expected build output');
    for (const output of built.output) {
      if (output.type === 'chunk') {
        expect(Object.keys(output.modules).some(id => id.includes('analysisFaults'))).toBe(false);
        expect(output.code).not.toContain('analysisFault');
      }
    }
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
