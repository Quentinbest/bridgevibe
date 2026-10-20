import { expect, test } from 'vitest';
import { card, dealWith } from '../../test/deals';
import { RANKS, SEATS, startPlaythrough, type Contract, type Playthrough, type ReasonCode, type Seat } from './index';
const contract: Contract = { level: 3, strain: 'no-trumps', declarer: 'south' };
const make = () => startPlaythrough({ deal: dealWith(), contract, learnerSide: 'northSouth' });
const state = (table: Playthrough) => ({ record: table.record(), turn: table.seatView('south').turn, views: SEATS.map(seat => table.seatView(seat)) });
function reject(table: Playthrough, seat: unknown, controller: unknown, action: unknown, reason: ReasonCode) {
  const before = state(table);
  const result = table.submit(seat, controller, action);
  expect(result).toMatchObject({ kind: 'rejected', reason });
  expect(state(table)).toEqual(before);
  return result;
}
function play(table: Playthrough, seat: Seat, chosen = table.legalActions(seat)[0]) {
  const result = table.submit(seat, table.controllerOf(seat), chosen);
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
  const table = startPlaythrough({ deal, contract, learnerSide: 'northSouth' });
  for (const seat of ['west', 'north', 'east', 'south'] as const) play(table, seat, { kind: 'play-card', card: deal.hands[seat][0] });
  expect(table.seatView('south')).toMatchObject({ turn: 'north', tricksWon: { northSouth: 1, eastWest: 0 }, currentTrick: [], tricks: [{ winner: 'north' }] });
});
for (const strain of ['hearts', 'no-trumps'] as const) {
  test(`void plays: highest trump wins, otherwise led suit (${strain})`, () => {
    const deal = dealWith({ west: RANKS.map(rank => card('spades', rank)), north: [card('hearts', '2')], east: [card('hearts', 'A')], south: [card('hearts', 'K')] });
    const table = startPlaythrough({ deal, contract: { ...contract, strain }, learnerSide: 'northSouth' });
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
test('US-01.5: replaying an already played card is malformed duplicate-card input', () => {
  const table = make(); const action = table.legalActions('west')[0];
  play(table, 'west', action);
  while (table.seatView('south').turn !== 'west') play(table, table.seatView('south').turn!);
  expect(reject(table, 'west', 'robot', action, 'malformed-action')).toMatchObject({ details: { cause: 'duplicate' } });
});
test('North declarer is learner-controlled and South dummy is learner-controlled', () => {
  const table = startPlaythrough({ deal: dealWith(), contract: { ...contract, declarer: 'north' }, learnerSide: 'northSouth' });
  expect(table.seatView('north').turn).toBe('east');
  play(table, 'east'); play(table, 'south'); play(table, 'west'); play(table, 'north');
  expect(table.record().actions.map(action => action.controller)).toEqual(['robot', 'learner', 'robot', 'learner']);
});
test('input and output mutation cannot alter authoritative state', () => {
  const deal = dealWith(); const table = startPlaythrough({ deal, contract, learnerSide: 'northSouth' }); const before = state(table);
  Object.assign(deal.hands.west[0], { rank: '2' });
  Object.assign(table.seatView('west').hand[0], { rank: '2' });
  Object.assign(table.record().deal.hands.west[0], { rank: '2' });
  Object.assign(table.legalActions('west')[0].card, { rank: '2' });
  expect(state(table)).toEqual(before);
});
test('ADR-0003, US-02.1: in defence the learner controls only South; Dummy follows the robot Declarer', () => {
  const table = startPlaythrough({ deal: dealWith(), contract: { ...contract, declarer: 'east' }, learnerSide: 'northSouth' });
  expect(SEATS.map(seat => table.controllerOf(seat))).toEqual(['robot', 'robot', 'learner', 'robot']);
  expect(table.seatView('south').turn).toBe('south');
  expect(reject(table, 'south', 'robot', table.legalActions('south')[0], 'malformed-action')).toMatchObject({ details: { cause: 'controller' } });
  play(table, 'south');
  // West is Dummy: only East's controller (a robot) may play its cards.
  reject(table, 'west', 'learner', table.legalActions('west')[0], 'only-declarer-plays-dummy');
  play(table, 'west');
  expect(reject(table, 'north', 'learner', table.legalActions('north')[0], 'malformed-action')).toMatchObject({ details: { cause: 'controller' } });
  play(table, 'north'); play(table, 'east');
  expect(table.record().actions.map(action => action.controller)).toEqual(['learner', 'robot', 'robot', 'robot']);
});
test('the learner sits South, so only North–South can be the learner side', () => {
  expect(() => startPlaythrough({ deal: dealWith(), contract, learnerSide: 'eastWest' })).toThrow();
});

// F1 / US-01.1–US-01.7: suit and seat variants exercise the public Table seam.
for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
  const other = suit === 'clubs' ? 'diamonds' : 'clubs';
  test(`F1 rejects an off-suit card while holding ${suit}, even when it is trump`, () => {
    const deal = dealWith({ west: [card(suit, '2')], north: [card(suit, '3'), card(other, 'A')] });
    const table = startPlaythrough({ deal, contract: { ...contract, strain: other }, learnerSide: 'northSouth' });
    play(table, 'west', { kind: 'play-card', card: card(suit, '2') });
    expect(reject(table, 'north', 'learner', { kind: 'play-card', card: card(other, 'A') }, 'must-follow-suit')).toMatchObject({ details: { suit } });
    expect(table.legalActions('north').every(action => action.card.suit === suit)).toBe(true);
  });
  test(`F1 accepts following ${suit} and advances clockwise`, () => {
    const deal = dealWith({ west: [card(suit, '2')], north: [card(suit, '3')] });
    const table = startPlaythrough({ deal, contract, learnerSide: 'northSouth' });
    play(table, 'west', { kind: 'play-card', card: card(suit, '2') });
    play(table, 'north', { kind: 'play-card', card: card(suit, '3') });
    expect(table.seatView('north').turn).toBe('east');
    expect(table.seatView('north').hand).not.toContainEqual(card(suit, '3'));
    expect(table.record().actions).toHaveLength(2);
  });
  test(`F1 highest ${suit} trump beats the led ace and lower trumps`, () => {
    const deal = dealWith({ west: RANKS.map(rank => card(other, rank)), north: [card(suit, '2')], east: [card(suit, 'K')], south: [card(suit, '3')] });
    const table = startPlaythrough({ deal, contract: { ...contract, strain: suit }, learnerSide: 'northSouth' });
    for (const seat of ['west', 'north', 'east', 'south'] as const) play(table, seat, { kind: 'play-card', card: deal.hands[seat][0] });
    expect(table.seatView('south')).toMatchObject({ turn: 'east', tricksWon: { eastWest: 1, northSouth: 0 }, tricks: [{ winner: 'east' }] });
  });
}
for (const seat of SEATS) {
  test(`F1 ${seat} cannot play another hand's card on its turn`, () => {
    const table = make();
    while (table.seatView('south').turn !== seat) play(table, table.seatView('south').turn!);
    const other = SEATS.find(candidate => candidate !== seat)!;
    reject(table, seat, table.controllerOf(seat), { kind: 'play-card', card: table.seatView(other).hand[0] }, 'card-not-held');
  });
  test(`F1 ${seat} cannot play out of turn`, () => {
    const declarer = SEATS[(SEATS.indexOf(seat) + 1) % 4];
    const table = startPlaythrough({ deal: dealWith(), contract: { ...contract, declarer }, learnerSide: 'northSouth' });
    reject(table, seat, table.controllerOf(seat), { kind: 'play-card', card: table.seatView(seat).hand[0] }, 'not-your-turn');
  });
}
test('F1 the final trick stays in progress until its fourth card; completion empties every hand', () => {
  const table = make();
  for (let index = 0; index < 48; index++) play(table, table.seatView('south').turn!);
  for (const seat of SEATS) expect(table.seatView(seat).hand).toHaveLength(1);
  for (let index = 0; index < 3; index++) {
    play(table, table.seatView('south').turn!);
    expect(table.seatView('south').status).toBe('in-progress');
    expect(table.seatView('south').tricks).toHaveLength(12);
  }
  play(table, table.seatView('south').turn!);
  expect(table.record().status).toBe('completed');
  for (const seat of SEATS) {
    expect(table.seatView(seat).hand).toEqual([]);
    reject(table, seat, table.controllerOf(seat), { kind: 'play-card', card: card('spades', 'A') }, 'playthrough-complete');
  }
});
