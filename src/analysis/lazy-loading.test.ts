import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { completeFixedDeal } from '../../test/strategy';
import { type PositionResult } from './index';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

// §4.7, US-46: verify actual shipped chunks and attribution, not source import spelling.
test.each(['bridge-dds', 'macroxue'])('the initial graph excludes solvers; %s alone ships in the worker', async solver => {
  const dir = mkdtempSync(join(tmpdir(), 'bridgevibe-analysis-'));
  const reportPath = join(dir, 'bom.json');
  vi.stubEnv('BRIDGEVIBE_LICENCE_REPORT', reportPath);
  vi.stubEnv('VITE_SOLVER', solver);
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
      expect(Object.keys(chunk.modules).some(id => id.includes('bridge-dds') || id.includes('macroxue'))).toBe(false);
      expect(chunk.code).not.toMatch(/SolveBoardPBN|CalcDDTablePBN|wasmBinary|WebAssembly\.instantiate|data:application\/wasm;base64,/);
      for (const file of chunk.imports) pending.push(built.output.find(output => output.fileName === file)!);
    }
    // §4.1.4: no page chunk, including deferred ones, carries macroxue's inline bytes.
    for (const output of built.output) if (output.type === 'chunk') {
      expect(output.code).not.toContain('data:application/wasm;base64,');
      expect(Object.keys(output.modules).some(id => id.includes('solver.wasm'))).toBe(false);
    }
    expect(built.output.some(output => output.fileName.endsWith('.wasm'))).toBe(false);
    const worker = built.output.find(output => /analysisWorker-.*\.js$/.test(output.fileName));
    expect(worker?.type).toBe('asset');
    const code = String(worker?.type === 'asset' ? worker.source : '');
    expect(code.includes('SolveBoardPBN')).toBe(solver === 'bridge-dds');
    expect(code.includes('data:application/wasm;base64,')).toBe(solver === 'macroxue');
    expect(code.includes('macroxue exit')).toBe(solver === 'macroxue');
    // US-41.1–3: execute the built worker with its real engine, including WASM initialisation.
    const responses: { type: string; result?: PositionResult }[] = [];
    const scope = { location: { href: 'https://bridgevibe.test/analysisWorker.js' }, postMessage: (response: typeof responses[number]) => responses.push(response),
      onmessage: undefined as undefined | ((event: { data: unknown }) => void) };
    runInNewContext(code, { self: scope, WorkerGlobalScope: class {}, WebAssembly, TextEncoder, TextDecoder, atob,
      console, setTimeout, clearTimeout });
    expect(responses[0]).toMatchObject({ type: 'hello' });
    scope.onmessage!({ data: { type: 'solve', requestId: 1, record: completeFixedDeal(), index: 40 } });
    await vi.waitFor(() => expect(responses).toHaveLength(2));
    expect(responses[1]).toMatchObject({ type: 'result', result: { name: solver,
      version: solver === 'macroxue' ? 'bridge-solver 630705d' : '1.4.0 / DDS 2.9' } });
    expect(responses[1].result?.classes.length).toBeGreaterThan(0);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.violations).toEqual([]);
    if (solver === 'bridge-dds') expect(report.artefacts.find((item: { name: string }) => item.name === 'bridge-dds')).toMatchObject({
      version: '1.4.0', licence: 'Apache-2.0', licenceFiles: ['node_modules/bridge-dds/LICENSE'], shippedFiles: [worker!.fileName],
    });
    else expect(report.artefacts.find((item: { name: string }) => item.name === 'src/analysis/macroxue/solver.wasm')).toMatchObject({
      version: expect.stringMatching(/^sha256:/), licence: 'MIT', licenceFiles: ['src/analysis/macroxue/LICENSE-MIT'], shippedFiles: [worker!.fileName],
    });
    expect(report.artefacts.some((item: { name: string }) => item.name === (solver === 'macroxue' ? 'bridge-dds' : 'src/analysis/macroxue/solver.wasm'))).toBe(false);
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
