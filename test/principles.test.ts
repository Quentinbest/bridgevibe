import { expect, test } from 'vitest';
import { principlesPolicy } from '../src/robots';
import { PRINCIPLE_RULE_IDS } from '../src/robots/principles';
import { SEATS, dealFromSeed, startMiniBridge, startPlaythrough, type Card, type Seat, type Contract } from '../src/table';
import { dealWith } from './deals';
import { generateSample } from '../scripts/robots/sample';

const cards = (suit: Card['suit'], ranks: string): Card[] => ranks.split(' ').filter(Boolean).map(rank => ({ suit, rank: rank as Card['rank'] }));
const s = (r: string) => cards('spades', r), h = (r: string) => cards('hearts', r), d = (r: string) => cards('diamonds', r), c = (r: string) => cards('clubs', r);
const provenance = { kind: 'robot' as const, policy: 'test', version: '1', durationMs: 0 };
function position(hands: Partial<Record<Seat, Card[]>>, plays: [Seat, Card][] = [], declarer: Seat = 'south', strain: Contract['strain'] = 'no-trumps') {
  const reserved = Object.values(hands).flat();
  expect(new Set(reserved.map(k => k.suit + k.rank)).size).toBe(reserved.length);
  const table = startPlaythrough({ deal: dealWith(hands), contract: { declarer, strain, level: 1 }, learnerSide: 'northSouth', gameFormat: 'minibridge' });
  for (const [seat, card] of plays) expect(table.submit(seat, table.controllerOf(seat), { kind: 'play-card', card }, table.controllerOf(seat) === 'robot' ? provenance : undefined).kind).toBe('accepted');
  const seat = table.seatView(declarer).turn!;
  const dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
  const view = table.seatView(seat === dummy ? declarer : seat);
  const decision = principlesPolicy.decide(view, 'fixed', Infinity);
  expect(table.legalActions(seat)).toContainEqual({ kind: 'play-card', card: decision.card });
  return decision;
}
// DEP-03: full acting hands keep Table's fixture filler out of the decision suit.
const filler = [...d('9 8 7 6 5'), ...c('9 8 7 6 5')];
const full = (main: Card[]) => [...main, ...filler.filter(k => !main.some(m => m.suit === k.suit && m.rank === k.rank))].slice(0, 13);
const check = (result: ReturnType<typeof position>, ruleId: string, card: Card) => expect(result).toEqual({ kind: 'play-card', ruleId, card });
test('lead-sequence: three and two touching honours lead the top', () => {
  for (const ranks of ['K Q J', 'K Q 3']) check(position({ west: full(s(ranks)) }), 'lead-sequence', s('K')[0]);
});
test('lead-long-suit: fourth highest with honour, second without, lowest from three', () => {
  check(position({ west: [...s('K J 9 7 3'), ...h('10 8 6 4'), ...d('10 8'), ...c('10 8')] }), 'lead-long-suit', s('7')[0]);
  check(position({ west: [...s('10 9 8 7 3'), ...h('10 8 6 4'), ...d('10 8'), ...c('10 8')] }), 'lead-long-suit', s('9')[0]);
});
test('lead-not-ace-without-king: redirect a long ace suit in a suit contract', () => {
  const west = [...s('A J 9 7 3'), ...h('K 8 6 4'), ...d('10 8'), ...c('10 8')];
  check(position({ west }, [], 'south', 'hearts'), 'lead-not-ace-without-king', h('4')[0]);
  check(position({ west }), 'lead-long-suit', s('7')[0]);
});
test('lead-short-suit: weak singleton and small doubleton', () => {
  check(position({ west: [...s('2'), ...h('10 8 6 4'), ...d('10 8 6 4'), ...c('10 8 6 4')] }, [], 'south', 'hearts'), 'lead-short-suit', s('2')[0]);
  check(position({ west: [...s('8 2'), ...h('10 8 6'), ...d('10 8 6 4'), ...c('10 8 6 4')] }, [], 'south', 'hearts'), 'lead-short-suit', s('8')[0]);
});
// East defends second after North (Dummy) leads: Declarer is South, so first win a trick for North.
function second(hand: Card[], lead = s('Q')[0], northRest = s('3')) {
  return position({ south: h('3'), west: h('4'), north: [...h('A'), lead, ...northRest], east: full([...h('2'), ...hand]) },
    [['west', h('4')[0]], ['north', h('A')[0]], ['east', h('2')[0]], ['south', h('3')[0]], ['north', lead]]);
}
test('second-hand-cover-honour: cover a lone honour, defer the first of touching Dummy honours', () => {
  check(second(s('K 8')), 'second-hand-cover-honour', s('K')[0]);
  check(second(s('K 8'), s('Q')[0], s('J 3')), 'second-hand-low', s('8')[0]);
});
test('second-hand-split-honours: lowest touching honour', () => {
  check(second(s('K Q J'), s('3')[0], s('6')), 'second-hand-split-honours', s('J')[0]);
});
test('second-hand-low: retain the ace', () => { check(second(s('A 8'), s('3')[0], s('6')), 'second-hand-low', s('8')[0]); });
function third(hand: Card[], west: string, north: string) {
  return position({ west: s(west), north: s(north), east: full(hand) }, [['west', s(west)[0]], ['north', s(north)[0]]]);
}
test('third-hand-win-cheaply: partner winning', () => { check(third(s('K J 2'), 'A', '3'), 'third-hand-win-cheaply', s('2')[0]); });
test('third-hand-high: beat Dummy cheaply', () => { check(third(s('K J 2'), '3', '8'), 'third-hand-high', s('J')[0]); });
test('fourth-hand-win-cheaply: win cheaply or retain partner winner', () => {
  const base = { north: s('3'), east: s('4'), south: s('Q'), west: full(s('A K 2')) };
  check(position(base, [['north', s('3')[0]], ['east', s('4')[0]], ['south', s('Q')[0]]], 'west'), 'fourth-hand-win-cheaply', s('K')[0]);
});
test('ruff-when-opponent-winning: cheapest ruff and overruff', () => {
  const east = [...h('K 9 2'), ...filler];
  check(position({ east, west: s('3'), north: s('A') }, [['west', s('3')[0]], ['north', s('A')[0]]], 'south', 'hearts'), 'ruff-when-opponent-winning', h('2')[0]);
  check(position({ east, west: s('3'), north: [...h('A Q J 10 8 7 6 5 4 3'), ...d('A K Q')] }, [['west', s('3')[0]], ['north', h('8')[0]]], 'south', 'hearts'), 'ruff-when-opponent-winning', h('9')[0]);
});
test('discard-low: longest honourless non-trump suit', () => {
  check(position({ east: [...h('A K Q'), ...filler], west: s('A'), north: s('2') }, [['west', s('A')[0]], ['north', s('2')[0]]], 'south', 'hearts'), 'discard-low', d('5')[0]);
});
test('return-partners-suit: first suit partner led', () => {
  check(position({ west: s('3'), north: s('4'), south: s('5'), east: full(s('A K 2')) }, [['west', s('3')[0]], ['north', s('4')[0]], ['east', s('A')[0]], ['south', s('5')[0]]]), 'return-partners-suit', s('2')[0]);
});
test('lead-through-strength: lead towards weak Dummy on the left', () => {
  check(position({ west: full(s('A K 2')), north: [...s('3'), ...h('10 9 8 7 6 5 4 3 2'), ...d('2 3 4')], east: s('4'), south: s('5') }, [['west', s('A')[0]], ['north', s('3')[0]], ['east', s('4')[0]], ['south', s('5')[0]]]), 'lead-through-strength', s('2')[0]);
});
test('tie-break: equal rank candidates use suit order', () => {
  check(position({ west: [...s('K Q 2'), ...h('K Q 3'), ...d('10 8 6 4'), ...c('10 8 6')] }), 'lead-sequence', s('K')[0]);
});

test('F7: 100 seeded MiniBridge Playthroughs, all seats, zero rejected cards and known rule IDs', () => {
  const roles = new Set<string>();
  for (let index = 0; index < 100; index++) {
    const setup = startMiniBridge({ deal: dealFromSeed('principles-soak', index + 1), learnerSide: 'northSouth' });
    while (setup.seatView('south').step !== 'contract-choice') setup.advance();
    const declarer = setup.seatView('south').declarer!, controller = setup.controllerOf(declarer);
    expect(setup.submit(declarer, controller, { kind: 'choose-contract', strain: index % 2 ? 'no-trumps' : 'hearts', objective: 'part-score' }, controller === 'robot' ? provenance : undefined).kind).toBe('accepted');
    const table = setup.playthrough()!;
    for (let n = 0; n < 52; n++) {
      const seat = table.seatView(declarer).turn!, dummy = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
      const view = table.seatView(seat === dummy ? declarer : seat), decision = principlesPolicy.decide(view, 'fixed', Infinity);
      roles.add(declarer);
      expect([...PRINCIPLE_RULE_IDS, 'fallback-lowest']).toContain(decision.ruleId);
      expect(table.submit(seat, table.controllerOf(seat), { kind: 'play-card', card: decision.card }, table.controllerOf(seat) === 'robot' ? { ...provenance, ruleId: decision.ruleId } : undefined).kind).toBe('accepted');
    }
    expect(table.record().status).toBe('completed');
  }
  expect(roles.size).toBe(4);
});
test('F7 generator is byte deterministic over two seeded deals', async () => {
  const first = await generateSample(2);
  expect(await generateSample(2)).toBe(first);
  expect(first.split('\n').filter(line => /^\| \d/.test(line))).toHaveLength(104);
});
function declarerLead(north: Card[], south: Card[], strain: Contract['strain'] = 'no-trumps') {
  return position({ north, south, west: s('3'), east: s('4') }, [['west', s('3')[0]], ['north', s('A')[0]], ['east', s('4')[0]], ['south', s('2')[0]]], 'south', strain);
}
test('declarer-draw-trumps: lead trump from either visible hand', () => {
  check(declarerLead([...s('A'), ...h('K Q J 3 2'), ...d('9 8 7'), ...c('9 8 7 6')], [...s('2 5'), ...h('A 10 9 8'), ...d('A K Q'), ...c('A K J 10')], 'hearts'), 'declarer-draw-trumps', h('K')[0]);
});
test('declarer-ruff-in-short-hand: use an affordable high trump', () => {
  check(position({ west: s('3'), north: [...h('Q 2'), ...d('9 8 7 6 5'), ...c('9 8 7 6 5 4')], south: [...h('A K J 10 9'), ...s('Q J 10 9 8'), ...d('A K Q')] }, [['west', s('3')[0]]], 'south', 'hearts'), 'declarer-ruff-in-short-hand', h('Q')[0]);
});
test('declarer-establish-long-suit: drive out a master while a side entry remains', () => {
  check(declarerLead([...s('A'), ...h('Q J 3'), ...d('9 8 7 6'), ...c('9 8 7 6 5')], [...s('2 5'), ...h('K 10 9 8 7 6'), ...d('A K Q'), ...c('A K')]), 'declarer-establish-long-suit', h('J')[0]);
});
test('declarer-high-from-short-side: cash short-side master first', () => {
  check(declarerLead([...s('A'), ...h('A 2'), ...d('9 8 7 6 5'), ...c('9 8 7 6 5')], [...s('2'), ...h('K Q J 10 9 8 7'), ...d('A K Q'), ...c('A K')]), 'declarer-high-from-short-side', h('A')[0]);
});
test('declarer-finesse: an honour led by partner is not a finesse; keep partner\'s winner', () => {
  const hands = {
    south: [...c('2 5 6'), ...s('2 3 4 5 6'), ...d('2 3 4 5 6')],
    west: [...c('A'), ...h('J 10 9 8'), ...s('7 8 9 10'), ...d('7 8 9 10')],
    north: [...c('3'), ...h('3 4 5 6 7'), ...s('J Q K A'), ...d('J Q K')],
    east: [...c('4 7 8 9 10 J Q K'), ...h('A K Q 2'), ...d('A')],
  };
  const plays: [Seat, Card][] = [['south', c('2')[0]], ['west', c('A')[0]], ['north', c('3')[0]], ['east', c('4')[0]], ['west', h('J')[0]], ['north', h('3')[0]]];
  check(position(hands, plays, 'east'), 'third-hand-win-cheaply', h('2')[0]);
});
test('declarer-finesse: lead low towards Q missing K, or K missing A', () => {
  for (const honour of ['Q', 'K']) check(declarerLead([...s('A'), ...h('8 7 6 2'), ...d('9 8 7 6'), ...c('9 8 7 6')], [...s('2 K Q J 10'), ...h(`${honour} 3`), ...d('A K Q'), ...c('A K Q')]), 'declarer-finesse', h('2')[0]);
});
test('declarer-cash-winners: no plan or master available, lead low from longest', () => {
  check(declarerLead([...s('A'), ...h('8 7 6 2'), ...d('9 8 7 6'), ...c('9 8 7 6')], [...s('2 K Q J 10 9 8 7 6 5'), ...h('9 3'), ...d('2')]), 'declarer-cash-winners', h('2')[0]);
});
test('declarer-draw-trumps: leave a lone outstanding winner; delay for short-side ruffs', () => {
  const north = [...s('A'), ...h('K Q J 10 9 8'), ...d('9 8 7'), ...c('9 8 7')];
  check(declarerLead(north, [...s('2'), ...h('7 6 5 4 3 2'), ...d('A K Q'), ...c('A K Q')], 'hearts'), 'declarer-cash-winners', h('8')[0]);
  check(declarerLead(north, [...s('2'), ...h('7 6 5'), ...d('A K Q J 10 6 5 4 3')], 'hearts'), 'declarer-ruff-in-short-hand', c('7')[0]);
});
test('declarer-high-from-short-side: overtake to avoid blocking the long hand', () => {
  check(position({ north: [...s('A'), ...h('K'), ...d('9 8 7 6 5'), ...c('9 8 7 6 5 4')], south: [...s('2 5'), ...h('A Q J 3'), ...d('A K Q'), ...c('A K Q J')], west: s('3'), east: [...s('4'), ...h('2')] },
    [['west', s('3')[0]], ['north', s('A')[0]], ['east', s('4')[0]], ['south', s('2')[0]], ['north', h('K')[0]], ['east', h('2')[0]]]), 'declarer-high-from-short-side', h('A')[0]);
});
test('second-hand-split-honours: QJ10 uses the ten', () => { check(second(s('Q J 10'), s('3')[0], s('6')), 'second-hand-split-honours', s('10')[0]); });
test('third-hand-high: force an honour over low Dummy, not a small card that fourth hand can beat', () => {
  check(third(s('K J 4'), '2', '3'), 'third-hand-high', s('J')[0]);
});
test('fourth-hand-win-cheaply: partner winning, play low', () => {
  check(position({ north: s('3'), east: s('A'), south: s('Q'), west: full(s('K J 2')) }, [['north', s('3')[0]], ['east', s('A')[0]], ['south', s('Q')[0]]], 'west'), 'fourth-hand-win-cheaply', s('2')[0]);
});
test('ruff-when-opponent-winning: do not ruff partner, or under-ruff an unbeatable trump', () => {
  const east = [...h('K 9 2'), ...filler];
  check(position({ east, west: s('A'), north: s('3') }, [['west', s('A')[0]], ['north', s('3')[0]]], 'south', 'hearts'), 'discard-low', d('5')[0]);
  check(position({ east, west: s('3'), north: [...h('A Q J 10 8 7 6 5 4 3'), ...d('A K Q')] }, [['west', s('3')[0]], ['north', h('A')[0]]], 'south', 'hearts'), 'discard-low', d('5')[0]);
});
test('lead-through-strength and return-partners-suit: never offer a known ruff and discard', () => {
  // Both declaring hands show out of spades; East wins West's spade lead.
  const east = [...s('A K 2'), ...filler];
  const north = [...h('A K Q J 10 9 8 7 6 5 4 3 2')];
  const south = [...d('A K Q J 10 4 3 2'), ...c('A K Q J 10')];
  const result = position({ east, north, south, west: s('3') }, [['west', s('3')[0]], ['north', h('2')[0]], ['east', s('A')[0]], ['south', d('2')[0]]]);
  expect(result.ruleId).toBe('lead-through-strength');
  expect(result.card.suit).not.toBe('spades');
});
test('lead-long-suit: lowest from three after excluding the ace-only suit', () => {
  check(position({ west: [...s('A J 9 3'), ...h('K 8 4'), ...d('Q 8 3'), ...c('K 8 2')] }, [], 'south', 'hearts'), 'lead-not-ace-without-king', c('2')[0]);
});
test('second-hand-cover-honour: cover the second honour; do not claim promotion for a jack with no lower candidate', () => {
  check(second(s('K 8'), s('J')[0], s('3')), 'second-hand-cover-honour', s('K')[0]);
  check(position({ north: [...s('J 10 9 8 7 6 5 4 3 2'), ...c('A'), ...h('2'), ...d('2')], east: [...s('K'), ...h('A K Q J'), ...d('A K Q J'), ...c('K Q J 2')], south: c('4'), west: c('3') },
    [['west', c('3')[0]], ['north', c('A')[0]], ['east', c('2')[0]], ['south', c('4')[0]], ['north', s('J')[0]]]), 'second-hand-low', s('K')[0]);
});
test('declarer-establish-long-suit: preserve control when no side entry remains', () => {
  const result = declarerLead([...s('A'), ...h('Q J 3'), ...d('9 8 7 6'), ...c('9 8 7 6 5')], [...s('2 5'), ...h('K 10 9 8 7 6'), ...d('K Q J'), ...c('K Q')]);
  expect(result.ruleId).not.toBe('declarer-establish-long-suit');
});
