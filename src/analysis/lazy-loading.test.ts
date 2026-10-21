import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

// §4.7, US-46: verify actual shipped chunks and attribution, not source import spelling.
test('the initial chunk graph excludes DDS; the worker carries its Apache licence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-analysis-'));
  const reportPath = join(dir, 'bom.json');
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', reportPath);
  try {
    const built = await build({ logLevel: 'silent', build: { outDir: join(dir, 'dist') } });
    if (Array.isArray(built) || !('output' in built)) throw new Error('Expected a single build output');
    const entry = built.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry);
    expect(entry?.type).toBe('chunk');
    const pending = [entry!]; const seen = new Set<string>();
    while (pending.length) {
      const chunk = pending.pop()!;
      if (chunk.type !== 'chunk' || seen.has(chunk.fileName)) continue;
      seen.add(chunk.fileName);
      expect(Object.keys(chunk.modules).some(id => id.includes('bridge-dds'))).toBe(false);
      expect(chunk.code).not.toMatch(/SolveBoardPBN|CalcDDTablePBN|wasmBinary|WebAssembly\.instantiate/);
      for (const file of chunk.imports) pending.push(built.output.find(output => output.fileName === file)!);
    }
    const worker = built.output.find(output => /analysisWorker-.*\.js$/.test(output.fileName));
    expect(worker?.type).toBe('asset');
    expect(String(worker?.type === 'asset' ? worker.source : '')).toContain('SolveBoardPBN');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.violations).toEqual([]);
    expect(report.artefacts.find((item: { name: string }) => item.name === 'bridge-dds')).toMatchObject({
      version: '1.4.0', licence: 'Apache-2.0', licenceFiles: ['node_modules/bridge-dds/LICENSE'], shippedFiles: [worker!.fileName],
    });
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
