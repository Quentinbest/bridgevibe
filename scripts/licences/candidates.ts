import { lstatSync, realpathSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Denylist } from './core.js';

// US-46.2: Node's on-demand entry point uses the same classifier as the build.
const { classifyLicence, grantsIn, isLicenceFile, prohibitedPaths, scanBytes } =
  await import(new URL('./core.ts', import.meta.url).href) as typeof import('./core.js');
export const MAX_BYTES = 50 * 1024 * 1024;

// LR-3: candidate sources contain camelCase continuations such as kSuitChar; ignore
// these matches only here. The build keeps conservative substring checks over our own bundle.
export function scanCandidateBytes(files: { path: string; bytes: Uint8Array }[], denylist: Denylist): string[] {
  return files.flatMap(file => {
    const bytes = Buffer.from(file.bytes);
    const byteStrings = denylist.byteStrings.filter(value => {
      const needle = Buffer.from(value);
      if (!/[A-Za-z0-9]$/.test(value)) return bytes.includes(needle);
      for (let offset = bytes.indexOf(needle); offset !== -1; offset = bytes.indexOf(needle, offset + 1)) {
        const next = bytes[offset + needle.length];
        if (next === undefined || next < 97 || next > 122) return true;
      }
      return false;
    });
    return scanBytes([file], { ...denylist, byteStrings });
  });
}

export interface Candidate {
  name: string;
  responsibility: string;
  source: string;
  commit?: string;
  version?: string;
  path: string;
  root?: 'repo';
  subpath?: string;
  metadataOnly?: true;
  contentRights?: string[];
  notes: string;
}
type Rule = `LR-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
type Verdict = 'pass' | 'fail' | 'open';
const rules: Rule[] = ['LR-1', 'LR-2', 'LR-3', 'LR-4', 'LR-5', 'LR-6', 'LR-7'];
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const safePath = (value: unknown): value is string => nonempty(value) && !/^[\\/]|[:\\]/.test(value) && [...value].every(char => char.charCodeAt(0) >= 32)
  && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');

// LR-1: validate every entry, including unused fields and exact pins.
export function validateRegister(value: unknown): Candidate[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Candidate register must be a non-empty array');
  const seen = new Set<string>();
  const allowed = ['name', 'responsibility', 'source', 'commit', 'version', 'path', 'root', 'subpath', 'metadataOnly', 'contentRights', 'notes'];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid candidate entry');
    const e = entry as Record<string, unknown>;
    const repo = typeof e.source === 'string' && /^https:\/\/[\w.-]+\/[\w./-]+$/.test(e.source);
    const npm = typeof e.source === 'string' && /^npm:(?:@[\w.-]+\/)?[\w.-]+$/.test(e.source);
    if (Object.keys(e).some(key => !allowed.includes(key))
      || !['name', 'responsibility', 'source', 'notes'].every(key => nonempty(e[key]))
      || !safePath(e.path) || ('subpath' in e && !safePath(e.subpath))
      || ('root' in e && e.root !== 'repo') || ('metadataOnly' in e && e.metadataOnly !== true)
      || ('contentRights' in e && (!Array.isArray(e.contentRights) || !e.contentRights.length || !e.contentRights.every(nonempty)))
      || !(repo ? typeof e.commit === 'string' && /^[a-f0-9]{40}$/.test(e.commit) && !('version' in e)
        : npm && typeof e.version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(e.version) && !('commit' in e))
      || (e.metadataOnly && (!repo || 'subpath' in e))
      || seen.has(String(e.name))) throw new Error(`Invalid candidate entry: ${String(e.name)}`);
    seen.add(String(e.name));
  }
  return value as Candidate[];
}
interface Evidence { path: string; classification: string; grants: string[]; scope: 'candidate' | 'context' | 'notice'; dual: boolean }
interface Claim { path: string; claim: string; grants: string[]; agreement: 'match' | 'disagreement' | 'unverified' }
interface Assessment {
  candidate: Candidate;
  licences: string[];
  evidence: Evidence[];
  metadata: Claim[];
  verdicts: Record<Rule, Verdict>;
  findings: string[];
  openItems: { dependency: 'DEP-08'; question: string }[];
  skipped: { path: string; reason: string }[];
}
const relative = (root: string, file: string) => path.relative(root, file).split(path.sep).join('/');
const metadataGrants = (claim: string) => [...new Set(claim.match(/(?:A?GPL|LGPL)(?:-[\w.-]+)?|MIT|Apache-2\.0|BSD-[23]-Clause|ISC|0BSD|Unlicense|OFL-1\.1/g) ?? [])]
  .map(grant => /GPL/.test(grant) ? 'GPL-family' : grant).sort();

function assess(candidate: Candidate, candidatesRoot: string, repoRoot: string, denylist: Denylist): Assessment {
  const result: Assessment = { candidate, licences: [], evidence: [], metadata: [],
    verdicts: { 'LR-1': 'pass', 'LR-2': 'pass', 'LR-3': 'pass', 'LR-4': 'pass', 'LR-5': 'pass', 'LR-6': 'pass', 'LR-7': 'pass' },
    findings: [], openItems: [], skipped: [] };
  const open = (rule: Rule, question: string) => {
    if (result.verdicts[rule] !== 'fail') result.verdicts[rule] = 'open';
    result.openItems.push({ dependency: 'DEP-08', question: `${rule}: ${question}` });
  };
  const base = path.resolve(candidate.root === 'repo' ? repoRoot : candidatesRoot);
  const root = path.join(base, candidate.path);
  const texts = new Map<string, string>();
  const paths: string[] = [];
  // LR-3: never follow symlinks, including checkout/subpath ancestors, outside the supplied root.
  let accessible = true;
  try {
    let current = base;
    for (const segment of candidate.path.split('/')) {
      current = path.join(current, segment);
      if (!lstatSync(current).isDirectory()) { accessible = false; break; }
    }
  } catch { accessible = false; }
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = path.join(dir, entry.name);
      const name = relative(root, file);
      if (entry.name === '.git') { result.skipped.push({ path: name, reason: '.git excluded' }); continue; }
      paths.push(name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile()) { result.skipped.push({ path: name, reason: 'symlink or non-regular file' }); continue; }
      if (lstatSync(file).size > MAX_BYTES) { result.skipped.push({ path: name, reason: `exceeds ${MAX_BYTES} bytes` }); continue; }
      const bytes = readFileSync(file);
      result.findings.push(...scanCandidateBytes([{ path: name, bytes }], denylist));
      if (isLicenceFile(entry.name) || ['package.json', 'Cargo.toml', 'pyproject.toml', 'tree.txt', 'COMMIT'].includes(entry.name)) texts.set(name, bytes.toString('utf8'));
    }
  }
  if (accessible) walk(root);
  else { result.skipped.push({ path: candidate.path, reason: 'checkout missing or not a directory (symlinks not followed)' }); open('LR-1', 'Checkout unavailable.'); }
  if (candidate.metadataOnly) {
    const tree = texts.get('tree.txt');
    if (!tree) open('LR-1', 'Metadata tree.txt missing.');
    for (const line of tree?.split(/\r?\n/).filter(line => line.trim()) ?? []) {
      const match = /^\S+\s+(?:\d+|-)\s+(.+)$/.exec(line);
      if (!match || !safePath(match[1])) { open('LR-3', `Unparsed tree entry: ${line}`); continue; }
      paths.push(match[1]);
    }
    if (texts.get('COMMIT')?.trim() !== candidate.commit) open('LR-1', 'Metadata COMMIT missing or differs from register pin.');
    open('LR-3', 'Metadata-only checkout: tree paths checked; repository file contents unavailable.');
    open('LR-7', 'Metadata-only checkout: nested licence files and package claims unavailable.');
  }
  result.findings.push(...prohibitedPaths(paths, denylist));
  if (result.findings.length) result.verdicts['LR-3'] = 'fail';
  if (result.skipped.some(item => item.reason !== '.git excluded')) {
    open('LR-3', 'Some files could not be byte-scanned; see skipped files.');
    open('LR-7', 'Skipped files may contain additional licence evidence.');
  }
  for (const [name, text] of texts) {
    if (!isLicenceFile(path.posix.basename(name))) continue;
    // LR-7: files outside the candidate's subpath are context, even notices.
    const scope = candidate.subpath && !name.startsWith(candidate.subpath + '/') ? 'context'
      : /(?:^|\/)(?:NOTICE|[^/]*THIRD[-_ ]?PARTY)[^/]*$/i.test(name) ? 'notice' : 'candidate';
    const grants = grantsIn(text);
    result.evidence.push({ path: name, classification: classifyLicence(text), grants, scope,
      dual: grants.length > 1 && /at your option|dual[- ]licen[cs]|(?:MIT|Apache[^\n]*|GPL[^\n]*)\s+or\s+(?:MIT|Apache|GPL)/i.test(text) });
  }
  const own = result.evidence.filter(item => item.scope === 'candidate');
  const top = candidate.subpath ?? '';
  const rootGrant = own.some(item => path.posix.dirname(item.path) === (top || '.') && item.grants.length);
  result.licences = [...new Set(own.flatMap(item => item.grants))].sort();
  if (!rootGrant || own.some(item => !item.grants.length)) {
    result.verdicts['LR-2'] = 'fail';
    result.findings.push('No recognised explicit grant covering the candidate, or an unrecognised nested licence (LR-2).');
    open('LR-2', 'Obtain/confirm explicit grants; unknown texts need manual review.');
    open('LR-7', 'Confirm scope of missing or unrecognised licence grants.');
    result.verdicts['LR-6'] = 'fail';
  }
  if (result.evidence.some(item => item.scope !== 'context' && item.grants.includes('GPL-family'))) {
    result.verdicts['LR-4'] = 'fail';
    result.findings.push('GPL-family: not usable in the browser bundle; server use needs separate review (LR-4).');
    open('LR-4', 'Review server use or an explicit non-GPL election; no election is made by this report.');
  }
  for (const [name, text] of texts) {
    let claim: string | undefined;
    if (path.posix.basename(name) === 'package.json') {
      try {
        const pkg = JSON.parse(text) as { license?: unknown; version?: unknown };
        if (pkg.license !== undefined) claim = typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license);
        if (name === 'package.json' && candidate.version && pkg.version !== candidate.version) open('LR-1', 'Installed package version differs from register pin.');
      } catch { open('LR-7', `Invalid package metadata: ${name}`); }
    } else if (['Cargo.toml', 'pyproject.toml'].includes(path.posix.basename(name))) {
      claim = /^license\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
    }
    if (claim === undefined) continue;
    const dir = path.posix.dirname(name);
    // LR-7: compare to the nearest licence scope, not a grant elsewhere in the repository.
    const applicable = result.evidence.filter(item => item.scope !== 'notice' && (path.posix.dirname(item.path) === '.'
      || dir === path.posix.dirname(item.path) || dir.startsWith(path.posix.dirname(item.path) + '/')));
    const depth = Math.max(...applicable.map(item => path.posix.dirname(item.path).length));
    const actual = [...new Set(applicable.filter(item => path.posix.dirname(item.path).length === depth).flatMap(item => item.grants))].sort();
    const claimed = metadataGrants(claim);
    const unknownTerms = claim.replace(/(?:A?GPL|LGPL)(?:-[\w.-]+)?|MIT|Apache-2\.0|BSD-[23]-Clause|ISC|0BSD|Unlicense|OFL-1\.1|\b(?:AND|OR)\b|[()\s/]/g, '');
    const agreement = unknownTerms || !claimed.length || !actual.length ? 'unverified' : JSON.stringify(claimed) === JSON.stringify(actual) ? 'match' : 'disagreement';
    result.metadata.push({ path: name, claim, grants: claimed, agreement });
    if (agreement !== 'match') {
      if (agreement === 'disagreement') { result.verdicts['LR-7'] = 'fail'; result.findings.push(`${name}: metadata licence disagrees with licence files (LR-7).`); }
      open('LR-7', `${name}: ${agreement} metadata claim ${claim}.`);
    }
  }
  for (const note of candidate.contentRights ?? []) { open('LR-5', note); open('LR-6', note); }
  return result;
}
export function scanCandidates(register: unknown, candidatesRoot: string, repoRoot: string, denylist: Denylist) {
  const candidates = validateRegister(register);
  return { generatedFor: candidates.map(({ name, commit, version }) => ({ name, ...(commit ? { commit } : { version }) })),
    byteLimit: MAX_BYTES, candidates: candidates.map(candidate => assess(candidate, candidatesRoot, repoRoot, denylist)) };
}
export type CandidateReport = ReturnType<typeof scanCandidates>;
const cell = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\|/g, '&#124;').replace(/\r?\n/g, ' ');
export function reportBytes(report: CandidateReport) {
  const lines = ['# Candidate licence report', '',
    'T3 / VAL-10 evidence only; the owner decides gate outcomes. Pins are register declarations, not verification of checkout cleanliness.',
    `Byte scans skip files over ${report.byteLimit} bytes (50 MiB), .git, symlinks and non-regular files. Paths are checkout-relative.`,
    'Pass means no issue detected by this assessment, not legal approval or proof of absence. LR-1 inventories candidates, not shipped artefacts. LR-5/6 cover registered rights questions; content provenance still needs review. Static tripwires do not establish run-time behaviour or model provenance.', '',
    '| Candidate | Pin | Licences found | ' + rules.join(' | ') + ' |',
    '| --- | --- | --- | ' + rules.map(() => '---').join(' | ') + ' |'];
  for (const item of report.candidates) lines.push(`| ${cell(item.candidate.name)} | ${item.candidate.commit ?? item.candidate.version} | ${cell(item.licences.join(', ') || 'no explicit grant')} | ${rules.map(rule => item.verdicts[rule]).join(' | ')} |`);
  for (const item of report.candidates) {
    const c = item.candidate;
    lines.push('', `## ${cell(c.name)}`, '', `${cell(c.responsibility)} — ${cell(c.source)} @ ${c.commit ?? c.version}`,
      '', `Checkout: ${cell(c.path)} (${c.root ?? 'candidates'} root); scope: ${cell(c.subpath ?? 'whole checkout')}.`, '', cell(c.notes), '',
      rules.map(rule => `${rule}: **${item.verdicts[rule]}**`).join('; '), '', 'Licence files:');
    for (const e of item.evidence) lines.push(`- ${cell(e.path)} [${e.scope}]: ${e.grants.join(', ') || e.classification}${e.dual ? ' (dual grant text)' : ''}`);
    if (!item.evidence.length) lines.push('- None found.');
    lines.push('', 'Metadata claims (not grants):');
    for (const m of item.metadata) lines.push(`- ${cell(m.path)}: ${cell(m.claim)} — ${m.agreement}`);
    if (!item.metadata.length) lines.push('- None available.');
    lines.push('', 'Findings:', ...item.findings.map(f => `- ${cell(f)}`));
    if (!item.findings.length) lines.push('- None detected.');
    lines.push('', 'Open items:', ...item.openItems.map(o => `- ${o.dependency}: ${cell(o.question)}`));
    if (!item.openItems.length) lines.push('- None recorded.');
    lines.push('', 'Skipped:', ...item.skipped.map(s => `- ${cell(s.path)}: ${s.reason}`));
    if (!item.skipped.length) lines.push('- None.');
  }
  return { json: JSON.stringify(report, null, 2) + '\n', markdown: lines.join('\n') + '\n' };
}
export function writeReports(report: CandidateReport, repoRoot: string) {
  const bytes = reportBytes(report);
  for (const [file, text] of [['licences/candidates-report.json', bytes.json], ['docs/reports/licence-candidates.md', bytes.markdown]]) {
    const target = path.join(repoRoot, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  if (process.argv.length !== 3) { console.error('Usage: node scripts/licences/candidates.ts <candidatesRoot>'); process.exitCode = 1; }
  else {
    const register: unknown = JSON.parse(readFileSync(path.join(repoRoot, 'licences/candidates.json'), 'utf8'));
    const denylist = JSON.parse(readFileSync(new URL('./denylist.json', import.meta.url), 'utf8')) as Denylist;
    writeReports(scanCandidates(register, path.resolve(process.argv[2]), repoRoot, denylist), repoRoot);
  }
}
