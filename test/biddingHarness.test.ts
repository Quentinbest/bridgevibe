import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ESLint } from 'eslint';
import { afterEach, expect, test } from 'vitest';
import { auctions, candidates, compare, handString, normalizeCall, parseResult, prepareCandidate, render, runProcess, saycbridgeCall } from '../tools/bidding-harness';
import type { Config, Runner } from '../tools/bidding-harness';

const fixture = resolve('test/fixtures/bidding/fake-engine.mjs');
const root = process.cwd();
const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function temp() { const path = mkdtempSync(resolve(tmpdir(), 't5-')); temporary.push(path); return path; }
const config: Config = Object.fromEntries(candidates.map(candidate => [candidate.name, {
  binary: 'rbb', python: 'python', command: { executable: 'Bridgit' },
}]));
const calls: { executable: string; args: string[] }[] = [];
const fake: Runner = (executable, args, cwd) => {
  calls.push({ executable, args });
  if (executable === 'git') {
    if (args[0] === 'status') return '';
    return candidates.find(candidate => cwd.endsWith(candidate.path))!.commit;
  }
  if (executable === 'dotnet') return '10.0';
  const mode = executable.endsWith('rbb') ? 'rbb' : executable.endsWith('python') ? 'saycbridge' : executable.endsWith('pons') ? 'pons' : 'Bridgit';
  return runProcess(process.execPath, [fixture, mode, ...args], root);
};

test('normalises engine call spellings and rejects malformed calls', () => {
  for (const [input, output] of [['1C', '1C'], ['1♣', '1C'], ['2♦', '2D'], ['3♥', '3H'], ['4♠', '4S'],
    ['Pass', 'Pass'], ['P', 'Pass'], ['X', 'X'], ['Dbl', 'X'], ['XX', 'XX'], ['1NT', '1NT'], ['1N', '1NT']]) {
    expect(normalizeCall(input)).toBe(output);
  }
  for (const value of ['8C', 'NT', '', null]) expect(() => normalizeCall(value)).toThrow();
  // rbb 0.10.0 CLI shape, from the real binary.
  expect(normalizeCall({ Bid: { level: 1, strain: 'NoTrump' } })).toBe('1NT');
  expect(normalizeCall({ Bid: { level: 4, strain: 'Spades' } })).toBe('4S');
  expect(normalizeCall('Double')).toBe('X');
  expect(() => normalizeCall({ Bid: { level: 1, strain: 'Stars' } })).toThrow();
  // saycbridge history spelling, from the real CallHistory.
  expect(['1NT', 'Pass', '1H', 'X', 'XX'].map(saycbridgeCall)).toEqual(['1N', 'P', '1H', 'X', 'XX']);
});
test('hand conversion preserves both suit orders and converts 10 to T', () => {
  const hand = { S: 'AK102', H: 'J107', D: 'Q94', C: 'K83' };
  expect(handString(hand, 'SHDC')).toBe('AKT2.JT7.Q94.K83');
  expect(handString(hand, 'CDHS')).toBe('K83.Q94.JT7.AKT2');
});
test('fake processes receive the real rbb and Python argument layouts and return provenance', () => {
  calls.length = 0;
  const rbb = prepareCandidate(candidates.find(c => c.name === 'rusty-bidding-bot')!, root, config, fake);
  expect(rbb.run(auctions[0])).toMatchObject({ call: '1C', ruleId: 'SAYC:opening.bid:12', provenance: 'rule' });
  expect(rbb.run(auctions[28])).toMatchObject({ call: 'Pass', ruleId: null, explanation: 'No rule applies', provenance: 'not-covered' });
  expect(rbb.status.engine.version).toContain('rbb 0.1.0-fixture');
  const sayc = prepareCandidate(candidates.find(c => c.name === 'saycbridge')!, root, config, fake);
  expect(sayc.run(auctions[0])).toMatchObject({ call: '1NT', ruleId: 'OneNotrumpOpening', provenance: 'rule' });
  expect(sayc.run(auctions[28])).toMatchObject({ call: null, ruleId: null, provenance: 'not-covered' });
  expect(calls.find(c => c.args[0] === 'call')!.args.slice(0, 8)).toEqual(['call', 'KQ4.A93.KJ72.Q85', '-a', '', '-d', 'S', '-v', 'None']);
  expect(calls.find(c => c.executable.endsWith('python'))!.args.slice(2)).toEqual(['Q85.KJ72.A93.KQ4', '', 'S']);
});
test('Bridgit default passes and missing provenance never become rule-backed', () => {
  const adapter = prepareCandidate(candidates[0], root, config, fake);
  expect(adapter.run(auctions[0])).toMatchObject({ call: 'Pass', ruleId: null, provenance: 'no-provenance' });
  expect(parseResult('Bridgit', '{"call":"P"}', adapter.status.engine).provenance).toBe('no-provenance');
  expect(parseResult('saycbridge', '{"call":"P","provenance":"rule"}', adapter.status.engine).provenance).toBe('no-provenance');
});
test('rusty-bidding-bot rule IDs name the file inside the checkout, not an absolute local path', () => {
  const engine = { name: 'rusty-bidding-bot', version: candidates.find(c => c.name === 'rusty-bidding-bot')!.commit };
  const output = '{"call":"1N","rule":{"module":"notrump-base","file":"/home/someone/rbb/conventions/notrump/one-nt.bid","line":63}}';
  expect(parseResult('rusty-bidding-bot', output, engine, '/home/someone/rbb').ruleId).toBe('notrump-base:conventions/notrump/one-nt.bid:63');
  expect(parseResult('rusty-bidding-bot', output.replace('/home/someone/rbb/', ''), engine, '/home/someone/rbb').ruleId).toBe('notrump-base:conventions/notrump/one-nt.bid:63');
});
test('Bridgit reports missing SDK or missing CLI', () => {
  const missing: Runner = (exe, args, cwd) => { if (exe === 'dotnet') throw new Error('missing'); return fake(exe, args, cwd); };
  expect(prepareCandidate(candidates[0], root, {}, missing).status.reason).toBe('.NET SDK not installed');
  expect(prepareCandidate(candidates[0], root, {}, fake).status.reason).toBe('no test-harness CLI configured');
});
test('pons refuses missing, malformed, false or wrong-version BBA-free manifests before running any process', () => {
  const build = temp();
  const candidate = candidates.find(c => c.name === 'pons')!;
  const forbidden: Runner = () => { throw new Error('must not execute'); };
  for (const manifest of [undefined, '{', '{}', JSON.stringify({ bbaFree: false, commit: candidate.commit, excludedWeights: ['american_bba_*'] }),
    JSON.stringify({ bbaFree: true, commit: 'wrong', excludedWeights: ['american_bba_*'] }),
    JSON.stringify({ bbaFree: true, commit: candidate.commit, excludedWeights: [] })]) {
    if (manifest !== undefined) writeFileSync(resolve(build, 'bba-free.json'), manifest);
    expect(prepareCandidate(candidate, root, { pons: { build } }, forbidden).status.reason).toBe('no BBA-free build (LR-3, T3)');
  }
  expect(prepareCandidate(candidate, root, {}, forbidden).status.reason).toBe('no BBA-free build (LR-3, T3)');
});
test('pons accepts a marked build and selects american_instinct', () => {
  const build = temp();
  const candidate = candidates.find(c => c.name === 'pons')!;
  writeFileSync(resolve(build, 'bba-free.json'), JSON.stringify({ bbaFree: true, commit: candidate.commit, excludedWeights: ['american_bba_*'] }));
  const buildOnly: Runner = (exe, args, cwd) => {
    expect(exe).not.toBe('git');
    return fake(exe, args, cwd);
  };
  const adapter = prepareCandidate(candidate, root, { pons: { build, command: { executable: 'pons' } } }, buildOnly);
  expect(adapter.run(auctions[0])).toMatchObject({ call: 'X', provenance: 'rule' });
  expect(prepareCandidate(candidate, root, { pons: { build, command: { executable: '../other' } } }, fake).status.status).toBe('not-run');
});
test('pins and malformed process output fail closed without partial candidate results', () => {
  const mismatch: Runner = () => 'wrong';
  expect(prepareCandidate(candidates[3], root, config, mismatch).status.reason).toContain('pin mismatch');
  const broken: Runner = (exe, args, cwd) => exe.endsWith('python') ? runProcess(process.execPath, [fixture, 'malformed'], root) : fake(exe, args, cwd);
  const report = compare(root, config, broken, auctions.slice(0, 1));
  expect(report.rows.find(row => row.engine.name === 'saycbridge')).toMatchObject({ status: 'not-run', result: null });
});
test('all 30 auctions × 4 candidates, blank grades, no drafter expectations, stable ordering and bytes', () => {
  expect(auctions).toHaveLength(30);
  const report = compare(root, config, fake);
  expect(report.rows).toHaveLength(120);
  expect(report.rows.every(row => row.teacherAGrade === '' && row.teacherBGrade === '' && row.resolutionNote === '')).toBe(true);
  const output = render(report);
  expect(output.csv.split('\n').filter(Boolean)).toHaveLength(121);
  expect(output.csv.split('\n')[0]).toContain('"Teacher A grade","Teacher B grade","Resolution note"');
  expect(output.csv.split('\n').slice(1, -1).every(line => line.endsWith(',"","",""'))).toBe(true);
  expect(output.csv).toContain('Opening, ""clubs""');
  expect(output.csv).toContain('not covered');
  expect(output.csv).toContain('no rule provenance');
  expect(output.json).not.toMatch(/expected|drafter|hcp|shape/i);
  expect(output.readme).toContain('not-run: no BBA-free build');
  for (const candidate of candidates) expect(output.readme).toContain(candidate.commit);
  expect(render(compare(root, config, fake, [...auctions].reverse()))).toEqual(output);
}, 60_000);
test('app import fixture fails dependency-cruiser and ESLint guards', async () => {
  const fixturePath = 'test/fixtures/bidding/src/app/forbidden.ts';
  const result = spawnSync(process.execPath, ['node_modules/dependency-cruiser/bin/dependency-cruiser.mjs', '--config', '.dependency-cruiser.cjs', fixturePath], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('no-app-bidding-harness');
  const source = readFileSync(fixturePath, 'utf8');
  for (const text of [source, 'void import("../../tools/bidding-harness/index");', 'require("../../tools/bidding-harness/index");']) {
    const [lint] = await new ESLint().lintText(text, { filePath: 'src/app/forbidden.ts' });
    expect(lint.messages.some(message => message.ruleId === 'harness/offline-only')).toBe(true);
  }
});

test('Node CLI writes the three reports to an explicit temporary output directory', () => {
  const directory = temp();
  const result = spawnSync(process.execPath, ['tools/bidding-harness/index.ts', '--candidates', directory, '--out', directory], {
    encoding: 'utf8', env: { ...process.env, PATH: directory },
  });
  expect(result.status, result.stderr).toBe(0);
  const report = JSON.parse(readFileSync(resolve(directory, 't5-results.json'), 'utf8'));
  expect(report.rows).toHaveLength(120);
  expect(report.candidates.every((candidate: { status: string }) => candidate.status === 'not-run')).toBe(true);
  expect(readFileSync(resolve(directory, 't5-sheet.csv'), 'utf8')).toContain('Teacher A grade');
  expect(readFileSync(resolve(directory, 'README.md'), 'utf8')).toContain('T5 bidding comparison');
});
