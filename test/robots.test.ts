import { expect, test } from 'vitest';
import { fallbackPolicy } from '../src/robots';
import { RANKS, startPlaythrough, type Card, type Contract, type SeatView } from '../src/table';
import { card, dealWith } from './deals';
const contract: Contract = { level: 3, strain: 'hearts', declarer: 'south' };
function view(hand: Card[], led?: Card, strain: Contract['strain'] = 'hearts'): SeatView {
  const deal = dealWith(led ? { west: [led], north: hand } : { west: hand });
  const table = startPlaythrough({ deal, contract: { ...contract, strain }, learnerSide: 'northSouth' });
  if (led) table.submit('west', 'robot', { kind: 'play-card', card: led }, { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 });
  return table.seatView(led ? 'north' : 'west');
}
const suit = (name: Card['suit'], ranks: Card['rank'][] = [...RANKS]) => ranks.map(rank => card(name, rank));
test('follows with lowest card, even when another suit is longer', () => {
  expect(fallbackPolicy(view([...suit('clubs', ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4']), ...suit('spades', ['K', '2'])], card('spades', 'A')))).toEqual(card('spades', '2'));
});
test('void: discards lowest card in longest non-trump suit, even with longer trumps', () => {
  expect(fallbackPolicy(view([...suit('hearts', ['A', 'K', 'Q', 'J', '10', '9']), ...suit('diamonds', ['A', 'K', '2']), ...suit('clubs', ['A', 'K', 'Q', '3'])], card('spades', 'A')))).toEqual(card('clubs', '3'));
});
test('only trumps remain: plays lowest trump', () => {
  expect(fallbackPolicy(view(suit('hearts'), card('spades', 'A')))).toEqual(card('hearts', '2'));
});
test('leading: lowest card of longest suit, including trumps', () => {
  expect(fallbackPolicy(view([...suit('hearts', ['A', 'K', 'Q', 'J', '10', '9', '2']), ...suit('clubs', ['A', 'K', 'Q', 'J', '10', '3'])]))).toEqual(card('hearts', '2'));
});
test('lead length ties use SUITS order', () => {
  expect(fallbackPolicy(view([...suit('spades', ['A', 'K', 'Q', '2']), ...suit('hearts', ['A', 'K', 'Q', '3']), ...suit('diamonds', ['A', 'K', '4']), ...suit('clubs', ['A', '5'])]))).toEqual(card('spades', '2'));
});
test('void discard ties use SUITS order; no-trumps excludes no suit', () => {
  expect(fallbackPolicy(view([...suit('hearts', ['A', 'K', 'Q', 'J', '2']), ...suit('diamonds', ['A', 'K', 'Q', 'J', '3']), ...suit('clubs', ['A', 'K', '4'])], card('spades', 'A'), 'no-trumps'))).toEqual(card('hearts', '2'));
});
