import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

test('I18N-23.1: production excludes preview locales', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-preview-'));
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', join(dir, 'bom.json'));
  try {
    const outDir = join(dir, 'dist');
    const result = await build({ mode: 'production', logLevel: 'silent', build: { outDir } });
    if (Array.isArray(result) || !('output' in result)) throw new Error('Expected build output');
    for (const output of result.output) if (output.type === 'chunk') {
      expect(Object.keys(output.modules).filter(id => /\/pseudo\.ts$|\/previewLocales\.ts$/.test(id))).toEqual([]);
    }
    for (const file of readdirSync(outDir, { recursive: true }).map(String)) {
      const path = join(outDir, file);
      if (!/\.(js|html|json|css)$/.test(file)) continue;
      const content = readFileSync(path, 'utf8');
      for (const marker of ['⟦', 'en-XA', 'あいうえおかきくけこさしすせそたちつてとなにぬねの橋牌学習']) expect(content).not.toContain(marker);
    }
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
