import { expect, test } from 'vitest';
import { dealWith } from '../../test/deals';
import { fixedPlaythrough } from '../../test/strategy';
import { decodeSeatView, encodeSeatView, startPlaythrough } from './index';
const make = () => startPlaythrough({ deal: dealWith(), contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
test('ADR-0001: wire data roundtrips and reconstructs the private Seat View brand', () => {
  const table = make(); const view = table.seatView('west'); const wire = encodeSeatView(view);
  expect(Object.getOwnPropertySymbols(wire)).toHaveLength(0);
  expect(decodeSeatView(structuredClone(wire))).toEqual(view);
  Object.assign(wire.hand[0], { rank: '2' });
  expect(table.seatView('west')).toEqual(view);
});
for (const bad of [null, [], {}, { seat: 'up' }, { positionIndex: -1 }, { positionIndex: 0.5 }, { hand: [{ suit: 'stars', rank: 'A' }] },
  { contract: { level: 0, strain: 'no-trumps', declarer: 'south' } }, { extra: [] }, { status: 'unknown' }, { turn: 1 },
  { dummy: {} }, { currentTrick: [{}] }, { tricks: [{ cards: [], winner: 'west' }] },
  { cardCounts: { north: 13, east: 13, south: 13, west: 14 } }, { tricksWon: { northSouth: NaN, eastWest: 0 } }]) {
  test(`ADR-0001: rejects malformed or extra wire fields ${JSON.stringify(bad)}`, () => {
    const wire = encodeSeatView(make().seatView('west'));
    expect(() => decodeSeatView(bad === null || Array.isArray(bad) || Object.keys(bad).length === 0 ? bad : { ...wire, ...bad })).toThrow();
  });
}
test('ADR-0001: rejects nested extra fields, symbols, and missing fields', () => {
  const wire = encodeSeatView(make().seatView('west'));
  for (const bad of [{ ...wire, contract: { ...wire.contract, hidden: [] } },
    { ...wire, hand: [{ ...wire.hand[0], hidden: [] }] }, { ...wire, [Symbol('extra')]: true },
    { ...wire, cardCounts: { north: 13 } }, { ...wire, hand: Array(1) },
    { ...wire, hand: Object.assign([...wire.hand], { extra: true }) }]) expect(() => decodeSeatView(bad)).toThrow();
});
test('§4.3.6: key is deterministic, rejection-stable, and changes only with accepted position', () => {
  const first = make(); const second = make(); const key = first.positionKey();
  expect(key).toMatch(/^[0-9a-f]{16}$/); expect(second.positionKey()).toBe(key);
  first.submit('south', 'learner', first.legalActions('west')[0]); expect(first.positionKey()).toBe(key);
  const action = first.legalActions('west')[0];
  const provenance = { kind: 'robot', policy: 'bv-fallback', version: '1', fallback: 'timeout', durationMs: 400 } as const;
  first.submit('west', 'robot', action, provenance); second.submit('west', 'robot', action, { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 });
  expect(first.positionKey()).not.toBe(key); expect(second.positionKey()).toBe(first.positionKey());
  expect(first.record().actions[0].provenance).toEqual(provenance);
  Object.assign(provenance, { policy: 'mutated' });
  expect(first.record().actions[0].provenance?.kind).toBe('robot');
  expect(first.record().actions[0].provenance).toMatchObject({ policy: 'bv-fallback' });
});
test('US-04.1: learner actions record learner provenance when the caller omits it', () => {
  const table = fixedPlaythrough();
  table.submit('west', 'robot', table.legalActions('west')[0], { kind: 'robot', policy: 'test-policy', version: '1', durationMs: 0 });
  table.submit('north', 'learner', table.legalActions('north')[0]);
  expect(table.record().actions[1].provenance).toEqual({ kind: 'learner' });
});
