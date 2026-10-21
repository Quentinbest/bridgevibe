// US-17.4 / F2: node scripts/solver/generate-f2.ts (Node 24, offline reference tools).
import { registerHooks } from 'node:module';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Layout, Position } from '../../src/analysis';
import type { Card } from '../../src/table';
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../../', import.meta.url).href)) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '/index.ts']) if (existsSync(fileURLToPath(url) + suffix)) return next(url.href + suffix, context);
  }
  return next(specifier, context);
} });
const { dealFromSeed, SEATS, SUITS, startPlaythrough } = await import('../../src/table/index');
const code = (card: Card) => 'SHDC'[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
const hands = (layout: Layout) => SEATS.map(seat => SUITS.map(suit => layout[seat].filter(card => card.suit === suit).map(card => code(card)[1]).join('')));
const cases = Array.from({ length: 20 }, (_, i) => {
  const deal = dealFromSeed('f2-smoke', i + 1);
  const strain = [...SUITS, 'no-trumps' as const][i % 5];
  const declarer = SEATS[i % 4];
  const table = startPlaythrough({ deal, contract: { level: 3, strain, declarer }, learnerSide: 'northSouth' });
  const positions: { layout: Layout; position: Position; plays: string[]; legal: string[]; leader: number; strain: number }[] = [];
  for (let n = 0; n <= 35; n++) {
    const view = table.seatView('south');
    const legal = table.legalActions(view.turn!);
    if ([16 + i % 4, 33 + i % 3].includes(n)) positions.push({
      layout: Object.fromEntries(SEATS.map(seat => [seat, table.seatView(seat).hand])) as Layout,
      position: { strain, leader: view.currentTrick[0]?.seat ?? view.turn!, currentTrick: view.currentTrick },
      plays: table.record().actions.map(entry => code(entry.action.card)), legal: legal.map(action => code(action.card)),
      leader: (i % 4 + 1) % 4, strain: i % 5,
    });
    const result = table.submit(view.turn, table.controllerOf(view.turn!), legal[0], { kind: 'imported', format: 'pbn' });
    if (result.kind !== 'accepted') throw new Error(result.reason);
  }
  return { dealId: deal.dealId, layout: deal.hands, pbn: 'N:' + hands(deal.hands).map(hand => hand.join('.')).join(' '), positions };
});
const root = '.reference-solvers';
mkdirSync(`${root}/mpl-cache`, { recursive: true });
const commit = execFileSync('git', ['-C', `${root}/bridge-solver`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!commit.startsWith('630705d')) throw new Error('Unexpected macroxue revision');
execFileSync('c++', ['-std=c++17', '-O3', '-I', `${root}/bridge-solver`, 'scripts/solver/macro-reference.cc', `${root}/bridge-solver/solver.cc`, '-o', `${root}/f2-macro`]);
const native = JSON.parse(execFileSync(`${root}/venv/bin/python`, ['scripts/solver/native-reference.py'], {
  input: JSON.stringify(cases), encoding: 'utf8', env: { ...process.env, MPLCONFIGDIR: `${process.cwd()}/${root}/mpl-cache` },
})) as { version: string; ddsVersion: string; results: { table: number[][]; positions: number[][] }[] };
if (native.version !== '0.5.12') throw new Error('Unexpected endplay version');
let disagreed = false;
const output = cases.map((item, i) => {
  const input = hands(item.layout).map(hand => hand.map(suit => suit || '-').join(' ')).join('\n') + '\n' + item.positions.map(p =>
    [p.strain, p.leader, p.plays.length, ...p.plays, p.legal.length, ...p.legal].join(' ')).join('\n');
  const values = execFileSync(`${root}/f2-macro`, { input, encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  const macro = { table: Array.from({ length: 5 }, () => values.splice(0, 4)), positions: item.positions.map(p => values.splice(0, p.legal.length)) };
  if (values.length || JSON.stringify(macro) !== JSON.stringify(native.results[i])) disagreed = true;
  return { ...item, native: native.results[i], macroxue: macro };
});
writeFileSync('src/analysis/f2-smoke.json', JSON.stringify({ generatedBy: 'scripts/solver/generate-f2.ts', seed: 'f2-smoke',
  references: { endplay: { version: native.version, dds: native.ddsVersion, licence: 'MIT' }, macroxue: { commit, licence: 'MIT OR Apache-2.0' } }, cases: output }, null, 2) + '\n');
hooks.deregister();
if (disagreed) throw new Error('F2 references disagree; both results were preserved in f2-smoke.json');
console.log('F2: 20 tables and 40 positions agree.');
