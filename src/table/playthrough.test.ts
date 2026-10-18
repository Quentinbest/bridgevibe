import { expect, test } from 'vitest';
import { card, dealWith } from '../../test/deals';
import { RANKS, SEATS, startPlaythrough, type Contract, type Playthrough, type ReasonCode, type Seat } from './index';
const contract: Contract = { level: 3, strain: 'no-trumps', declarer: 'south' };
const make = () => startPlaythrough({ deal: dealWith(), contract });
const state = (table: Playthrough) => ({ record: table.record(), turn: table.seatView('south').turn, views: SEATS.map(seat => table.seatView(seat)) });
function reject(table: Playthrough, seat: unknown, controller: unknown, action: unknown, reason: ReasonCode) {
  const before = state(table);
  const result = table.submit(seat, controller, action);
  expect(result).toMatchObject({ kind: 'rejected', reason });
  expect(state(table)).toEqual(before);
  return result;
}
function play(table: Playthrough, seat: Seat, chosen = table.legalActions(seat)[0]) {
  const result = table.submit(seat, seat === 'north' || seat === 'south' ? 'learner' : 'robot', chosen);
  expect(result.kind).toBe('accepted'); return result;
}
// F1 / US-01: run these identical card-play cases in Node and Chromium.
for (const action of [null, {}, { kind: 'bid' }, { kind: 'play-card', card: { suit: 'stars', rank: 'A' } }, { kind: 'play-card', card: { suit: 'spades', rank: '1' } }]) {
  test(`malformed card play leaves all state unchanged: ${JSON.stringify(action)}`, () => reject(make(), 'west', 'robot', action, 'malformed-action'));
}
test('unknown seat is malformed', () => reject(make(), 'up', 'robot', { kind: 'play-card', card: card('spades', 'A') }, 'malformed-action'));
test('unknown controller is malformed', () => reject(make(), 'west', 'other', { kind: 'play-card', card: card('spades', 'A') }, 'malformed-action'));
test('wrong controller on defender precedes turn checks', () => {
  const table = make();
  expect(reject(table, 'east', 'learner', table.legalActions('west')[0], 'malformed-action')).toMatchObject({ details: { cause: 'controller' } });
});
test('robot cannot act as declarer', () => reject(make(), 'south', 'robot', { kind: 'play-card', card: card('spades', 'A') }, 'malformed-action'));
test('wrong turn precedes ownership and dummy controller checks', () => reject(make(), 'north', 'robot', { kind: 'play-card', card: card('spades', 'A') }, 'not-your-turn'));
test('dummy must be played by declarer controller', () => {
  const table = make(); play(table, 'west');
  reject(table, 'north', 'robot', table.legalActions('north')[0], 'only-declarer-plays-dummy');
});
test('card not held is rejected', () => {
  const table = make();
  reject(table, 'west', 'robot', { kind: 'play-card', card: table.seatView('south').hand[0] }, 'card-not-held');
});
test('must follow suit names the led suit', () => {
  const table = make(); play(table, 'west');
  const led = table.seatView('north').currentTrick[0].card.suit;
  const offSuit = table.seatView('north').hand.find(card => card.suit !== led)!;
  expect(reject(table, 'north', 'learner', { kind: 'play-card', card: offSuit }, 'must-follow-suit')).toMatchObject({ details: { suit: led } });
});
test('blind opening lead exposes dummy to every seat only after a card is played', () => {
  const table = make();
  for (const seat of SEATS) expect(table.seatView(seat).dummy).toBeNull();
  play(table, 'west');
  for (const seat of SEATS) expect(table.seatView(seat).dummy).toEqual(table.seatView('north').hand);
});
test('legalActions is pure and empty for seats not to play', () => {
  const table = make(); const before = state(table);
  expect(table.legalActions('west')).toHaveLength(13);
  expect(table.legalActions('south')).toEqual([]);
  expect(state(table)).toEqual(before);
});
test('highest card of suit led wins without trumps and leads next', () => {
  const deal = dealWith({ west: [card('spades', '2')], north: [card('spades', 'A')], east: [card('spades', 'Q')], south: [card('spades', 'K')] });
  const table = startPlaythrough({ deal, contract });
  for (const seat of ['west', 'north', 'east', 'south'] as const) play(table, seat, { kind: 'play-card', card: deal.hands[seat][0] });
  expect(table.seatView('south')).toMatchObject({ turn: 'north', tricksWon: { northSouth: 1, eastWest: 0 }, currentTrick: [], tricks: [{ winner: 'north' }] });
});
for (const strain of ['hearts', 'no-trumps'] as const) {
  test(`void plays: highest trump wins, otherwise led suit (${strain})`, () => {
    const deal = dealWith({ west: RANKS.map(rank => card('spades', rank)), north: [card('hearts', '2')], east: [card('hearts', 'A')], south: [card('hearts', 'K')] });
    const table = startPlaythrough({ deal, contract: { ...contract, strain } });
    for (const seat of ['west', 'north', 'east', 'south'] as const) play(table, seat, { kind: 'play-card', card: deal.hands[seat][0] });
    expect(table.seatView('south').turn).toBe(strain === 'hearts' ? 'east' : 'west');
  });
}
test('all 13 tricks complete with ordered events and completion takes precedence over malformed input', () => {
  const table = make();
  for (let index = 0; index < 52; index++) {
    const seat = table.seatView('south').turn!;
    const result = play(table, seat);
    expect(table.record().actions[index]).toMatchObject({ index, seat });
    if (index === 51) expect(result).toMatchObject({ events: [{ kind: 'card-played' }, { kind: 'trick-won' }, { kind: 'status-changed', status: 'completed' }] });
  }
  expect(table.seatView('south')).toMatchObject({ status: 'completed', turn: null });
  expect(table.record().result.northSouth + table.record().result.eastWest).toBe(13);
  for (const seat of SEATS) expect(table.legalActions(seat)).toEqual([]);
  reject(table, null, null, null, 'playthrough-complete');
});
test('duplicate played card is no longer held on a later turn', () => {
  const table = make(); const action = table.legalActions('west')[0];
  play(table, 'west', action);
  while (table.seatView('south').turn !== 'west') play(table, table.seatView('south').turn!);
  reject(table, 'west', 'robot', action, 'card-not-held');
});
test('North declarer is learner-controlled and South dummy is learner-controlled', () => {
  const table = startPlaythrough({ deal: dealWith(), contract: { ...contract, declarer: 'north' } });
  expect(table.seatView('north').turn).toBe('east');
  play(table, 'east'); play(table, 'south'); play(table, 'west'); play(table, 'north');
  expect(table.record().actions.map(action => action.controller)).toEqual(['robot', 'learner', 'robot', 'learner']);
});
test('input and output mutation cannot alter authoritative state', () => {
  const deal = dealWith(); const table = startPlaythrough({ deal, contract }); const before = state(table);
  Object.assign(deal.hands.west[0], { rank: '2' });
  Object.assign(table.seatView('west').hand[0], { rank: '2' });
  Object.assign(table.record().deal.hands.west[0], { rank: '2' });
  Object.assign(table.legalActions('west')[0].card, { rank: '2' });
  expect(state(table)).toEqual(before);
});
