// US-17.4 / F2: node scripts/solver/generate-f2.ts (Node 24, offline reference tools).
import { registerHooks } from 'node:module';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Layout, Position } from '../../src/analysis';
import type { Card, Deal, Rank } from '../../src/table';
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith(new URL('../../', import.meta.url).href)) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['.ts', '/index.ts']) if (existsSync(fileURLToPath(url) + suffix)) return next(url.href + suffix, context);
  }
  return next(specifier, context);
} });
const { dealFromSeed, dealIdOf, RANKS, SEATS, SUITS, startPlaythrough } = await import('../../src/table/index');
// F2: `--full` is the spec's set (endplay generate_deals(produce=100, seed=42), 200 positions in tricks 2–12);
// the default is the 20-deal smoke set.
const full = process.argv.includes('--full');
const root = '.reference-solvers';
const python = `${root}/venv/bin/python`;
const pbnDeal = (pbn: string, index: number): Deal => {
  const hands = Object.fromEntries(pbn.slice(2).split(' ').map((hand, s) => [SEATS[s], hand.split('.').flatMap((ranks, suit) =>
    [...ranks].map(rank => ({ suit: SUITS[suit], rank: (rank === 'T' ? '10' : rank) as Rank })))
    .sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank))])) as unknown as Deal['hands'];
  const deal = { hands, dealer: 'north' as const, vulnerability: { northSouth: false, eastWest: false } };
  return { ...deal, dealId: dealIdOf(deal), origin: { kind: 'authored', contentId: `f2-endplay-seed-42-${index}`, version: 1 } };
};
const deals = full
  ? (JSON.parse(execFileSync(python, ['-c', 'import json; from endplay.dealer import generate_deals; '
    + 'print(json.dumps([d.to_pbn() for d in generate_deals(produce=100, seed=42)]))'], { encoding: 'utf8',
    env: { ...process.env, MPLCONFIGDIR: `${process.cwd()}/${root}/mpl-cache` } })) as string[]).map(pbnDeal)
  : Array.from({ length: 20 }, (_, i) => dealFromSeed('f2-smoke', i + 1));
// Full set: two positions per deal after 4–47 plays (tricks 2–12), covering every current-trick length;
// plays vary by index so lines are not all "first legal card".
const stops = (i: number) => full ? [4 + (i * 7) % 44, 4 + (i * 7 + 22) % 44] : [16 + i % 4, 33 + i % 3];
const pick = (i: number, n: number, count: number) => full ? (i * 5 + n * 3) % count : 0;
const code = (card: Card) => 'SHDC'[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
const hands = (layout: Layout) => SEATS.map(seat => SUITS.map(suit => layout[seat].filter(card => card.suit === suit).map(card => code(card)[1]).join('')));
const cases = deals.map((deal, i) => {
  const strain = [...SUITS, 'no-trumps' as const][i % 5];
  const declarer = SEATS[i % 4];
  const table = startPlaythrough({ deal, contract: { level: 3, strain, declarer }, learnerSide: 'northSouth' });
  const positions: { layout: Layout; position: Position; plays: string[]; legal: string[]; leader: number; strain: number }[] = [];
  for (let n = 0; n <= Math.max(...stops(i)); n++) {
    const view = table.seatView('south');
    const legal = table.legalActions(view.turn!);
    if (stops(i).includes(n)) positions.push({
      layout: Object.fromEntries(SEATS.map(seat => [seat, table.seatView(seat).hand])) as Layout,
      position: { strain, leader: view.currentTrick[0]?.seat ?? view.turn!, currentTrick: view.currentTrick },
      plays: table.record().actions.map(entry => code(entry.action.card)), legal: legal.map(action => code(action.card)),
      leader: (i % 4 + 1) % 4, strain: i % 5,
    });
    const result = table.submit(view.turn, table.controllerOf(view.turn!), legal[pick(i, n, legal.length)], { kind: 'imported', format: 'pbn' });
    if (result.kind !== 'accepted') throw new Error(result.reason);
  }
  return { dealId: deal.dealId, layout: deal.hands, pbn: 'N:' + hands(deal.hands).map(hand => hand.join('.')).join(' '), positions };
});
mkdirSync(`${root}/mpl-cache`, { recursive: true });
const commit = execFileSync('git', ['-C', `${root}/bridge-solver`, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!commit.startsWith('630705d')) throw new Error('Unexpected macroxue revision');
execFileSync('c++', ['-std=c++17', '-O3', '-I', `${root}/bridge-solver`, 'scripts/solver/macro-reference.cc', `${root}/bridge-solver/solver.cc`, '-o', `${root}/f2-macro`]);
const native = JSON.parse(execFileSync(python, ['scripts/solver/native-reference.py'], {
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
writeFileSync(`src/analysis/f2-${full ? 'full' : 'smoke'}.json`, JSON.stringify({ generatedBy: `scripts/solver/generate-f2.ts${full ? ' --full' : ''}`,
  ...(full ? { source: 'endplay generate_deals(produce=100, seed=42)' } : { seed: 'f2-smoke' }),
  references: { endplay: { version: native.version, dds: native.ddsVersion, licence: 'MIT' }, macroxue: { commit, licence: 'MIT OR Apache-2.0' } }, cases: output }, null, 2) + '\n');
hooks.deregister();
if (disagreed) throw new Error(`F2 references disagree; both results were preserved in f2-${full ? 'full' : 'smoke'}.json`);
console.log(`F2: ${cases.length} tables and ${cases.flatMap(item => item.positions).length} positions agree.`);
