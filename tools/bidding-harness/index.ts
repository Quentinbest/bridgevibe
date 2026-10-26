import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import register from '../../licences/candidates.json' with { type: 'json' };
import data from '../../docs/domain/t5-auctions-draft/auctions.json' with { type: 'json' };

export type Auction = typeof data.auctions[number];
export type Engine = { name: string; version: string };
export type Result = {
  call: string | null; ruleId: string | null; explanation: string | null;
  provenance: 'rule' | 'not-covered' | 'no-provenance'; engine: Engine;
};
export type CandidateStatus = { engine: Engine; status: 'run' | 'not-run'; reason: string | null };
export type Command = { executable: string; args?: string[] };
export type Config = Record<string, {
  checkout?: string; binary?: string; python?: string;
  command?: Command; build?: string;
}>;
export type Runner = (executable: string, args: string[], cwd: string) => string;
export const runProcess: Runner = (executable, args, cwd) => {
  const child = spawnSync(executable, args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
  if (child.error || child.status !== 0) throw new Error(`process failed: ${executable} (${child.error?.message ?? child.status})`);
  return child.stdout.trim();
};
const names = ['Bridgit', 'pons', 'rusty-bidding-bot', 'saycbridge'];
export const candidates = names.map(name => {
  const entry = register.find(item => item.name === name);
  if (!entry?.commit) throw new Error(`Missing pin: ${name}`);
  return { name, commit: entry.commit, path: entry.path };
});
export const auctions: Auction[] = data.auctions;

const STRAINS: Record<string, string> = { Clubs: 'C', Diamonds: 'D', Hearts: 'H', Spades: 'S', NoTrump: 'NT' };
export function normalizeCall(value: unknown): string {
  // rbb's CLI (0.10.0) prints bids as {"Bid": {"level": 1, "strain": "NoTrump"}}, unlike its WASM API.
  if (value && typeof value === 'object' && 'Bid' in value) {
    const bid = (value as { Bid: { level?: unknown; strain?: unknown } }).Bid;
    if (Number.isInteger(bid?.level) && typeof bid.strain === 'string' && STRAINS[bid.strain]) return normalizeCall(`${bid.level}${STRAINS[bid.strain]}`);
    throw new Error('Invalid rbb bid');
  }
  if (typeof value !== 'string') throw new Error('Missing call');
  const call = value.trim().toUpperCase().replace(/\s/g, '')
    .replace('♣', 'C').replace('♦', 'D').replace('♥', 'H').replace('♠', 'S');
  if (['P', 'PASS'].includes(call)) return 'Pass';
  if (['X', 'DBL', 'DOUBLE'].includes(call)) return 'X';
  if (['XX', 'RDBL', 'REDOUBLE'].includes(call)) return 'XX';
  if (/^[1-7](C|D|H|S|NT|N)$/.test(call)) return call.replace(/N$/, 'NT');
  throw new Error(`Invalid call: ${value}`);
}
// saycbridge's CallHistory spells passes `P` and no-trumps `N` (`1N`); it rejects `Pass` and `1NT`.
export const saycbridgeCall = (value: string) => normalizeCall(value).replace(/^Pass$/, 'P').replace(/NT$/, 'N');
export function handString(hand: Auction['hand'], order: 'SHDC' | 'CDHS'): string {
  return [...order].map(suit => hand[suit as keyof typeof hand].replaceAll('10', 'T')).join('.');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  return value as Record<string, unknown>;
}
function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
export function parseResult(name: string, output: string, engine: Engine): Result {
  const response = object(JSON.parse(output));
  let ruleId: string | null = null;
  let provenance: Result['provenance'] = 'no-provenance';
  if (name === 'rusty-bidding-bot') {
    if (response.rule === null) provenance = 'not-covered';
    else if (response.rule !== undefined) {
      const rule = object(response.rule);
      if (!nullableText(rule.module) || !nullableText(rule.file) || !Number.isInteger(rule.line) || Number(rule.line) < 1) {
        throw new Error('Invalid rbb rule location');
      }
      ruleId = `${rule.module}:${rule.file}:${rule.line}`;
      provenance = 'rule';
    }
  } else if (response.provenance === 'not-covered') provenance = 'not-covered';
  else if (response.provenance === 'rule' && nullableText(response.ruleId)) {
    ruleId = nullableText(response.ruleId);
    provenance = 'rule';
  }
  // VAL-11: a default Pass is not evidence of a matched rule.
  if (name === 'Bridgit' && response.defaultPass === true) {
    provenance = 'no-provenance';
    ruleId = null;
  }
  const call = response.call === null && provenance === 'not-covered' ? null : normalizeCall(response.call);
  return { call, ruleId, explanation: nullableText(response.explanation), provenance, engine };
}

export function prepareCandidate(candidate: typeof candidates[number], root: string, config: Config, run: Runner = runProcess) {
  const settings = config[candidate.name] ?? {};
  const checkout = resolve(root, settings.checkout ?? candidate.path);
  const engine = { name: candidate.name, version: candidate.commit };
  const status: CandidateStatus = { engine, status: 'not-run', reason: null };
  let invoke: ((auction: Auction) => string) | undefined;
  try {
    let build: string | undefined;
    if (candidate.name === 'pons') {
      // LR-3, T3: no executable (including version probes) runs before this gate.
      const refusal = 'no BBA-free build (LR-3, T3)';
      if (!settings.build) throw new Error(refusal);
      build = resolve(root, settings.build);
      try {
        const manifest = object(JSON.parse(readFileSync(resolve(build, 'bba-free.json'), 'utf8')));
        if (manifest.bbaFree !== true || manifest.commit !== candidate.commit ||
          !Array.isArray(manifest.excludedWeights) || !manifest.excludedWeights.includes('american_bba_*')) throw new Error(refusal);
      } catch { throw new Error(refusal); }
    }
    if (candidate.name === 'Bridgit') {
      try { run('dotnet', ['--version'], root); }
      catch { throw new Error('.NET SDK not installed'); }
    }
    // US-47: never label an unverified checkout with the intended pin.
    if (!build) {
      const actual = run('git', ['rev-parse', 'HEAD'], checkout);
      if (actual !== candidate.commit) throw new Error(`checkout pin mismatch: expected ${candidate.commit}, got ${actual}`);
      if (run('git', ['status', '--porcelain', '--untracked-files=no'], checkout)) throw new Error('checkout has tracked modifications');
    }
    if (candidate.name === 'rusty-bidding-bot') {
      const binary = resolve(checkout, settings.binary ?? 'target/release/rbb');
      const version = run(binary, ['--version'], checkout);
      if (!version) throw new Error('empty rbb version');
      engine.version = `${candidate.commit} (${version})`;
      invoke = auction => run(binary, ['call', handString(auction.hand, 'SHDC'), '-a', auction.auction.map(normalizeCall).join(' '),
        '-d', auction.dealer, '-v', 'None', '--card', resolve(checkout, 'cards/bbsa/SAYC.bbsa'),
        '--rules', resolve(checkout, 'conventions'), '--json'], checkout);
    } else if (candidate.name === 'saycbridge') {
      const python = resolve(checkout, settings.python ?? '.venv/bin/python');
      invoke = auction => run(python, [fileURLToPath(new URL('./saycbridge_call.py', import.meta.url)), checkout,
        handString(auction.hand, 'CDHS'), auction.auction.map(saycbridgeCall).join(' '), auction.dealer], checkout);
    } else {
      const command = settings.command;
      if (!command) throw new Error('no test-harness CLI configured');
      const cwd = build ?? checkout;
      const executable = resolve(cwd, command.executable);
      // T3: the pons entry point must belong to the build bearing the manifest.
      if (build && !executable.startsWith(build + '/')) throw new Error('pons entry point is outside the BBA-free build');
      invoke = auction => run(executable, [...(command.args ?? []), JSON.stringify({
        ...auction, ...(candidate.name === 'pons' ? { profile: 'american_instinct' } : {}),
      })], cwd);
    }
    status.status = 'run';
  } catch (error) {
    status.reason = error instanceof Error ? error.message : String(error);
  }
  return {
    status,
    run(auction: Auction): Result {
      if (!invoke || status.status !== 'run') throw new Error(status.reason ?? 'candidate unavailable');
      if (auction.vulnerability !== 'none') throw new Error('Only the T5 non-vulnerable auctions are supported');
      return parseResult(candidate.name, invoke(auction), engine);
    },
  };
}

export type Row = {
  auctionId: string; tags: string[]; dealer: string; auction: string[]; seat: string; hand: Auction['hand'];
  engine: Engine; status: 'run' | 'not-run'; reason: string | null; result: Result | null;
  teacherAGrade: ''; teacherBGrade: ''; resolutionNote: '';
};
export function compare(root: string, config: Config = {}, run: Runner = runProcess, input = auctions) {
  const statuses: CandidateStatus[] = [];
  const rows: Row[] = [];
  for (const candidate of candidates) {
    const adapter = prepareCandidate(candidate, root, config, run);
    const results = new Map<string, Result>();
    if (adapter.status.status === 'run') {
      try {
        for (const auction of input) results.set(auction.id, adapter.run(auction));
      } catch (error) {
        // US-47: do not publish a partially successful candidate as a complete run.
        adapter.status.status = 'not-run';
        adapter.status.reason = error instanceof Error ? error.message : String(error);
        results.clear();
      }
    }
    statuses.push(adapter.status);
    for (const auction of input) rows.push({
      auctionId: auction.id, tags: auction.tags, dealer: auction.dealer, auction: auction.auction,
      seat: auction.seat, hand: auction.hand, engine: adapter.status.engine,
      status: adapter.status.status, reason: adapter.status.reason, result: results.get(auction.id) ?? null,
      teacherAGrade: '', teacherBGrade: '', resolutionNote: '',
    });
  }
  rows.sort((a, b) => a.auctionId.localeCompare(b.auctionId, 'en') || a.engine.name.localeCompare(b.engine.name, 'en'));
  return { candidates: statuses, rows };
}
export function render(report: ReturnType<typeof compare>) {
  const headers = ['Auction ID', 'Tags', 'Dealer', 'Auction', 'Seat', 'Hand', 'Candidate', 'Engine version', 'Call',
    'Rule ID / not covered / no rule provenance', 'Explanation', 'Teacher A grade', 'Teacher B grade', 'Resolution note'];
  const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = report.rows.map(row => {
    const result = row.result;
    const rule = result ? result.ruleId ?? (result.provenance === 'not-covered' ? 'not covered' : 'no rule provenance') : 'not-run';
    return [row.auctionId, row.tags.join('; '), row.dealer, row.auction.join(' '), row.seat,
      `S:${row.hand.S} H:${row.hand.H} D:${row.hand.D} C:${row.hand.C}`, row.engine.name, row.engine.version,
      result?.call ?? '', rule, result?.explanation ?? (row.reason ? `not-run: ${row.reason}` : ''), '', '', ''];
  });
  const readme = ['# T5 bidding comparison', '', ...report.candidates.map(candidate =>
    `- ${candidate.engine.name} — ${candidate.engine.version} — ${candidate.status}${candidate.reason ? `: ${candidate.reason}` : ''}`), '',
  'D1: SAYC-based profile; T5 uses the beginner subset common to SAYC and 2/1.',
  'Draft auctions await both teachers. Grade independently, then resolve disagreements (VAL-11).',
  'No grading or selection is automated. Missing provenance is never rule-backed.',
  'Selection (PRD §14): highest teacher accuracy with complete provenance and explicit not-covered abstentions;',
  'ties use licence simplicity and browser fit. VAL-11 accuracy threshold: 90% (provisional).', ''].join('\n');
  return { csv: [headers, ...lines].map(line => line.map(csvCell).join(',')).join('\n') + '\n',
    json: JSON.stringify(report, null, 2) + '\n', readme };
}
export function main(args: string[]) {
  const { values } = parseArgs({ args, options: { candidates: { type: 'string' }, out: { type: 'string' } } });
  if (!values.candidates) throw new Error('Usage: npm run bidding:harness -- --candidates <root> [--out <dir>]');
  const root = resolve(values.candidates);
  const configPath = resolve(root, 'bidding-harness.json');
  const config: Config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8')) : {};
  const output = render(compare(root, config));
  const out = values.out ? resolve(values.out) : resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/reports/t5');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 't5-sheet.csv'), output.csv);
  writeFileSync(resolve(out, 't5-results.json'), output.json);
  writeFileSync(resolve(out, 'README.md'), output.readme);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
