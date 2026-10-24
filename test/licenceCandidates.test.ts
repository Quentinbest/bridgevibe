import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, truncateSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_BYTES, reportBytes, scanCandidateBytes, scanCandidates, validateRegister, writeReports } from '../scripts/licences/candidates';
import { scanBytes } from '../scripts/licences/core';
import type { Candidate } from '../scripts/licences/candidates';
import denylist from '../scripts/licences/denylist.json';
import register from '../licences/candidates.json';

const root = fileURLToPath(new URL('./fixtures/licences/candidates', import.meta.url));
const candidate = (name: string, extra: Partial<Candidate> = {}): Candidate => ({ name, responsibility: 'Test candidate',
  source: 'https://example.com/test/repo', commit: 'a'.repeat(40), path: name, notes: 'Synthetic classifier fixture, not a legal licence.', ...extra });
const scan = (name: string, extra: Partial<Candidate> = {}) => scanCandidates([candidate(name, extra)], root, root, denylist).candidates[0];
const temporary: string[] = [];
const temp = () => { const dir = mkdtempSync(path.join(tmpdir(), 'licence-candidates-')); temporary.push(dir); return dir; };
afterEach(() => temporary.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })));

describe('T3 / VAL-10 candidate licence assessment', () => {
  it.each(['kSuitChar', 'SuitClick', 'NewSuitClubs', 'EPBottom', 'handleHandSuitClick', 'focusedSuitCaret'])('ignores camelCase continuation %s', value => {
    expect(scanCandidateBytes([{ path: 'source.txt', bytes: Buffer.from(value) }], denylist)).toEqual([]);
  });
  it.each([
    ['SuitC', 'SuitC'], ['SuitC.exe', 'SuitC'], ['libEPBot.so', 'EPBot'],
    ['EPBotWrapper', 'EPBot'], ['SuitC64', 'SuitC'], ['american_bba_v1', 'american_bba_'],
    ['kSuitC.exe', 'SuitC'], ['EPBot', 'EPBot'], ['kSuitChar SuitC.exe', 'SuitC'],
  ])('retains prohibited bytes in %s', (value, needle) => {
    expect(scanCandidateBytes([{ path: 'source.txt', bytes: Buffer.from(value) }], denylist))
      .toEqual([`source.txt: prohibited bytes ${needle}`]);
  });
  it('keeps the build scanner conservative for kSuitChar', () => {
    expect(scanBytes([{ path: 'bundle.js', bytes: Buffer.from('kSuitChar') }], denylist))
      .toEqual(['bundle.js: prohibited bytes SuitC']);
  });
  it('applies the boundary rule to candidate file verdicts', () => {
    const base = temp();
    mkdirSync(path.join(base, 'boundary'));
    writeFileSync(path.join(base, 'boundary/LICENSE'), readFileSync(path.join(root, 'mit/LICENSE')));
    const source = path.join(base, 'boundary/source.txt');
    const run = () => scanCandidates([candidate('boundary')], base, base, denylist).candidates[0];
    writeFileSync(source, 'kSuitChar SuitClick NewSuitClubs EPBottom');
    expect(run().verdicts['LR-3']).toBe('pass');
    writeFileSync(source, 'kSuitChar SuitC.exe');
    expect(run().verdicts['LR-3']).toBe('fail');
    expect(run().findings).toContain('source.txt: prohibited bytes SuitC');
  });
  it('accepts the 13 pinned gate candidates', () => {
    expect(validateRegister(register)).toHaveLength(13);
    expect(register.find(c => c.name === 'pons')?.subpath).toBeUndefined();
  });
  it('passes MIT using the actual licence and records metadata separately', () => {
    const result = scan('mit');
    expect(Object.values(result.verdicts)).toEqual(Array(7).fill('pass'));
    expect(result.evidence[0]).toMatchObject({ path: 'LICENSE', grants: ['MIT'] });
    expect(result.metadata[0]).toMatchObject({ claim: 'MIT', agreement: 'match' });
  });
  it('flags GPL browser use and opens server review', () => {
    const result = scan('gpl');
    expect(result.verdicts['LR-4']).toBe('fail');
    expect(result.openItems).toContainEqual(expect.objectContaining({ dependency: 'DEP-08', question: expect.stringContaining('server use') }));
  });
  it('fails LR-2 without an explicit grant and creates DEP-08', () => {
    const result = scan('missing');
    expect(result.verdicts['LR-2']).toBe('fail');
    expect(result.verdicts['LR-6']).toBe('fail');
    expect(result.openItems).toContainEqual(expect.objectContaining({ dependency: 'DEP-08', question: expect.stringContaining('LR-2') }));
  });
  it('recognises dual grant text and metadata', () => {
    const result = scan('dual');
    expect(result.licences).toEqual(['Apache-2.0', 'MIT']);
    expect(result.evidence[0].dual).toBe(true);
    expect(result.metadata[0].agreement).toBe('match');
  });
  it('retains separate licence files and their OR metadata expression', () => {
    const result = scan('separate');
    expect(result.licences).toEqual(['Apache-2.0', 'MIT']);
    expect(result.evidence.map(item => item.path)).toEqual(['LICENSE-APACHE', 'LICENSE-MIT']);
    expect(result.metadata[0]).toMatchObject({ claim: 'MIT OR Apache-2.0', agreement: 'match' });
  });
  it('never substitutes package claims for missing files or silently accepts unknown terms', () => {
    const base = temp();
    mkdirSync(path.join(base, 'claims'));
    writeFileSync(path.join(base, 'claims/package.json'), '{"license":"MIT"}');
    const run = () => scanCandidates([candidate('claims')], base, base, denylist).candidates[0];
    expect(run().verdicts['LR-2']).toBe('fail');
    writeFileSync(path.join(base, 'claims/LICENSE'), readFileSync(path.join(root, 'mit/LICENSE')));
    writeFileSync(path.join(base, 'claims/package.json'), '{"license":"MIT AND Custom-Terms"}');
    expect(run().metadata[0].agreement).toBe('unverified');
    expect(run().verdicts['LR-7']).toBe('open');
  });
  it('reports prohibited paths and bytes with paths', () => {
    const result = scan('hits');
    expect(result.verdicts['LR-3']).toBe('fail');
    expect(result.findings).toContain('BBA/model.txt: prohibited path (LR-3)');
    expect(result.findings).toContain('BBA/model.txt: prohibited bytes american_bba_');
  });
  it('flags metadata disagreement without treating metadata as a grant', () => {
    const result = scan('mismatch');
    expect(result.verdicts['LR-7']).toBe('fail');
    expect(result.licences).toEqual(['MIT']);
    expect(result.metadata[0].agreement).toBe('disagreement');
  });
  it('keeps nested licences and limits the grant to the registered subpath', () => {
    const result = scan('nested', { subpath: 'packages/core' });
    expect(result.licences).toEqual(['Apache-2.0', 'MIT']);
    expect(result.verdicts['LR-4']).toBe('pass');
    expect(result.evidence[0]).toMatchObject({ scope: 'context', grants: ['GPL-family'] });
    expect(result.metadata[0].agreement).toBe('match');
  });
  it('treats a sibling third-party notice outside the subpath as context', () => {
    const base = temp();
    mkdirSync(path.join(base, 'scoped/packages/core'), { recursive: true });
    mkdirSync(path.join(base, 'scoped/packages/unrelated'), { recursive: true });
    writeFileSync(path.join(base, 'scoped/packages/core/LICENSE'), readFileSync(path.join(root, 'mit/LICENSE')));
    writeFileSync(path.join(base, 'scoped/packages/unrelated/THIRD-PARTY-LICENSE'), readFileSync(path.join(root, 'gpl/LICENSE')));
    const result = scanCandidates([candidate('scoped', { subpath: 'packages/core' })], base, base, denylist).candidates[0];
    expect(result.verdicts['LR-4']).toBe('pass');
    expect(result.evidence.find(item => item.path.endsWith('THIRD-PARTY-LICENSE'))?.scope).toBe('context');
  });
  it('scans metadata tree paths without claiming a complete byte scan', () => {
    const result = scan('metadata', { metadataOnly: true });
    expect(result.findings).toContain('BBA/engine.dll: prohibited path (LR-3)');
    expect(result.openItems.some(item => item.question.includes('contents unavailable'))).toBe(true);
    expect(result.verdicts['LR-7']).toBe('open');
  });
  it('records content rights as open LR-5 and LR-6 items', () => {
    const result = scan('mit', { contentRights: ['EPBot-filtered deals; third-party permission unverified.'] });
    expect(result.verdicts['LR-5']).toBe('open');
    expect(result.verdicts['LR-6']).toBe('open');
    expect(result.openItems).toHaveLength(2);
  });
  it.each([{ unexpected: true }, { commit: 'main' }, { version: '1.0.0' }, { path: '../escape' },
    { path: '/absolute' }, { subpath: 'a/../b' }, { root: 'elsewhere' }, { notes: '' }, { contentRights: [false] },
    { source: 'npm:test', commit: undefined, version: '^1.0.0' }])('rejects malformed register entries: %j', invalid => {
    expect(() => validateRegister([{ ...candidate('mit'), ...invalid }])).toThrow('Invalid candidate');
  });
  it('rejects duplicate identities and non-array registers', () => {
    expect(() => validateRegister([candidate('mit'), candidate('mit')])).toThrow();
    expect(() => validateRegister({})).toThrow();
  });
  it('uses the repo root for npm and reports a version mismatch', () => {
    const entry = candidate('mit', { source: 'npm:test', version: '2.0.0', root: 'repo' });
    delete entry.commit;
    const result = scanCandidates([entry], temp(), root, denylist).candidates[0];
    expect(result.licences).toEqual(['MIT']);
    expect(result.verdicts['LR-1']).toBe('open');
  });
  it('reports size skips, .git exclusions and symlinks without reading their targets', () => {
    const base = temp();
    mkdirSync(path.join(base, 'scan/.git'), { recursive: true });
    writeFileSync(path.join(base, 'scan/.git/secret'), 'american_bba_');
    writeFileSync(path.join(base, 'scan/LICENSE'), readFileSync(path.join(root, 'mit/LICENSE')));
    writeFileSync(path.join(base, 'scan/large'), '');
    truncateSync(path.join(base, 'scan/large'), MAX_BYTES + 1);
    symlinkSync(path.join(root, 'hits'), path.join(base, 'scan/link'));
    const result = scanCandidates([candidate('scan')], base, base, denylist).candidates[0];
    expect(result.skipped.map(item => item.path)).toEqual(['.git', 'large', 'link']);
    expect(result.findings).toEqual([]);
    expect(result.verdicts['LR-3']).toBe('open');
  });
  it('reports missing checkouts instead of passing', () => {
    expect(scan('absent').verdicts['LR-1']).toBe('open');
    expect(scan('absent').verdicts['LR-2']).toBe('fail');
  });
  it('runs the documented Node entry point against fixtures only', () => {
    const workspace = temp();
    mkdirSync(path.join(workspace, 'scripts/licences'), { recursive: true });
    mkdirSync(path.join(workspace, 'licences'));
    writeFileSync(path.join(workspace, 'package.json'), '{"type":"module"}');
    for (const file of ['candidates.ts', 'core.ts', 'denylist.json']) {
      writeFileSync(path.join(workspace, 'scripts/licences', file), readFileSync(new URL(`../scripts/licences/${file}`, import.meta.url)));
    }
    writeFileSync(path.join(workspace, 'licences/candidates.json'), JSON.stringify([candidate('mit')]));
    execFileSync(process.execPath, [path.join(workspace, 'scripts/licences/candidates.ts'), root]);
    const report = JSON.parse(readFileSync(path.join(workspace, 'licences/candidates-report.json'), 'utf8'));
    expect(report.candidates[0].licences).toEqual(['MIT']);
    expect(readFileSync(path.join(workspace, 'docs/reports/licence-candidates.md'), 'utf8')).toContain('LR-7: **pass**');
  });
  it('writes byte-identical JSON and Markdown on two independent scans', () => {
    const entries = ['mit', 'gpl', 'dual', 'hits', 'missing', 'mismatch'].map(name => candidate(name));
    const output = temp();
    const run = () => scanCandidates(entries, root, root, denylist);
    writeReports(run(), output);
    const first = ['licences/candidates-report.json', 'docs/reports/licence-candidates.md'].map(file => readFileSync(path.join(output, file)));
    writeReports(run(), output);
    const second = ['licences/candidates-report.json', 'docs/reports/licence-candidates.md'].map(file => readFileSync(path.join(output, file)));
    expect(second).toEqual(first);
    expect(reportBytes(run()).markdown).toContain('DEP-08');
    expect(JSON.parse(first[0].toString()).generatedFor).toHaveLength(6);
  });
});
