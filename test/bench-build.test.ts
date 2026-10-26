import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

test('production emits no benchmark modules, workers, fixtures or marker', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-bench-build-'));
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', join(dir, 'bom.json'));
  try {
    const outDir = join(dir, 'dist');
    const result = await build({ mode: 'production', logLevel: 'silent', build: { outDir } });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected build output');
    for (const output of result.output) if (output.type === 'chunk') {
      expect(Object.keys(output.modules).filter(id => /\/bench\/|f2-full\.json/.test(id))).toEqual([]);
    }
    for (const file of readdirSync(outDir, { recursive: true }).map(String).filter(file => /\.(js|html|json)$/.test(file))) {
      const code = readFileSync(join(outDir, file), 'utf8');
      expect(code).not.toContain('bridgevibe-device-bench-T2-v1');
      expect(code).not.toContain('bridgevibe-device-benchmark');
    }
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
