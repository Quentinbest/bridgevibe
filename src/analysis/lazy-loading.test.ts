import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { completeFixedDeal } from '../../test/strategy';
import { startPlaythrough, encodeSeatView } from '../table';
import type { HintResult } from './hintResult';
type HintResponse = { type: 'hello' } | { type: 'result'; result: HintResult };
import { type PositionResult } from './index';
import { build } from 'vite';
import { expect, test, vi } from 'vitest';

// §4.7, US-46: verify actual shipped chunks and attribution, not source import spelling.
test.each(['bridge-dds', 'macroxue', 'dds31'])('the initial graph excludes solvers; %s alone ships in the worker', async solver => {
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
      expect(Object.keys(chunk.modules).some(id => id.includes('bridge-dds') || id.includes('macroxue') || id.includes('dds31') || id.endsWith('/information/index.ts'))).toBe(false);
      expect(chunk.code).not.toMatch(/SolveBoardPBN|CalcDDTablePBN|wasmBinary|WebAssembly\.instantiate|data:application\/wasm;base64,/);
      for (const file of chunk.imports) pending.push(built.output.find(output => output.fileName === file)!);
    }
    // §4.1.4: no page chunk, including deferred ones, carries standalone inline bytes.
    for (const output of built.output) if (output.type === 'chunk') {
      expect(output.code).not.toContain('data:application/wasm;base64,');
      expect(Object.keys(output.modules).some(id => id.endsWith('.wasm?inline'))).toBe(false);
    }
    expect(built.output.some(output => output.fileName.endsWith('.wasm'))).toBe(false);
    const worker = built.output.find(output => /analysisWorker-.*\.js$/.test(output.fileName));
    expect(worker?.type).toBe('asset');
    const hintWorker = built.output.find(output => /hintWorker-.*\.js$/.test(output.fileName));
    expect(hintWorker?.type).toBe('asset');
    const hintCode = String(hintWorker?.type === 'asset' ? hintWorker.source : '');
    expect(hintCode.includes('SolveBoardPBN')).toBe(solver === 'bridge-dds');
    expect(hintCode.includes('data:application/wasm;base64,')).toBe(solver !== 'bridge-dds');
    const code = String(worker?.type === 'asset' ? worker.source : '');
    expect(code.includes('SolveBoardPBN')).toBe(solver === 'bridge-dds');
    expect(code.includes('data:application/wasm;base64,')).toBe(solver !== 'bridge-dds');
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
    expect(responses[1]).toMatchObject({ type: 'result', result: { name: solver === 'dds31' ? 'dds-3.1' : solver,
      version: solver === 'dds31' ? '3.1.0 fe6a658 single-threaded' : solver === 'macroxue' ? 'bridge-solver 630705d' : '1.4.0 / DDS 2.9' } });
    expect(responses[1].result?.classes.length).toBeGreaterThan(0);
    // US-14.5, ADR-0001: execute the emitted hint worker against a real late Seat View.
    const record = completeFixedDeal();
    const table = startPlaythrough({ deal: record.deal, contract: record.contract, learnerSide: record.learnerSide });
    for (const entry of record.actions.slice(0, 48)) table.submit(entry.seat, entry.controller, entry.action, entry.provenance);
    const turn = table.seatView('south').turn!;
    const hintResponses: HintResponse[] = [];
    const hintScope = { ...scope, postMessage: (response: HintResponse) => hintResponses.push(response), onmessage: undefined as typeof scope.onmessage };
    const hintContext = createContext({ self: hintScope, WorkerGlobalScope: class {}, WebAssembly, TextEncoder, TextDecoder, atob, console, setTimeout, clearTimeout });
    runInContext(hintCode, hintContext);
    expect(hintResponses[0]).toMatchObject({ type: 'hello' });
    const hintRequest = { type: 'hint', requestId: 2, view: encodeSeatView(table.seatView(turn)), candidates: table.legalActions(turn).map(a => a.card), seed: 'emitted', deadline: Date.now() + 3000 };
    runInContext(`self.onmessage({ data: ${JSON.stringify(hintRequest)} })`, hintContext);
    await vi.waitFor(() => expect(hintResponses).toHaveLength(2));
    expect(hintResponses[1]).toMatchObject({ type: 'result', result: { enumerated: true } });
    if (hintResponses[1].type !== 'result' || 'abstention' in hintResponses[1].result) throw new Error('Hint worker abstained');
    expect(hintResponses[1].result.classes.length).toBeGreaterThan(0);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(report.violations).toEqual([]);
    if (solver === 'bridge-dds') expect(report.artefacts.find((item: { name: string }) => item.name === 'bridge-dds')).toMatchObject({
      version: '1.4.0', licence: 'Apache-2.0', licenceFiles: ['node_modules/bridge-dds/LICENSE'], shippedFiles: [worker!.fileName, hintWorker!.fileName],
    });
    else if (solver === 'macroxue') expect(report.artefacts.find((item: { name: string }) => item.name === 'src/analysis/macroxue/solver.wasm')).toMatchObject({
      version: expect.stringMatching(/^sha256:/), licence: 'MIT', licenceFiles: ['src/analysis/macroxue/LICENSE-MIT'], shippedFiles: [worker!.fileName, hintWorker!.fileName],
    });
    else expect(report.artefacts.find((item: { name: string }) => item.name === 'src/analysis/dds31/dds31.wasm')).toMatchObject({
      version: expect.stringMatching(/^sha256:/), licence: 'Apache-2.0', licenceFiles: ['src/analysis/dds31/LICENSE'], shippedFiles: [worker!.fileName, hintWorker!.fileName],
    });
    const assets = { 'bridge-dds': 'bridge-dds', macroxue: 'src/analysis/macroxue/solver.wasm', dds31: 'src/analysis/dds31/dds31.wasm' };
    for (const [selection, name] of Object.entries(assets)) {
      expect(report.artefacts.some((item: { name: string }) => item.name === name)).toBe(selection === solver);
    }
    for (const workerCode of [code, hintCode]) {
      for (const [selection, path] of Object.entries(assets)) if (selection !== 'bridge-dds') {
        expect(workerCode.includes(readFileSync(path).toString('base64'))).toBe(selection === solver);
      }
    }
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
}, 60000);
