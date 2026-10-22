import { expect, test } from 'vitest';
import { dealFromSeed, dealIdOf, rotateDeal, startMiniBridge, highCardPoints, SEATS, sideOf,
  startPlaythrough, exportRecordJson, importRecordJson, exportPbn, importPbn, type Deal, type Side } from './index';

const nsPoints = (deal: Deal) => highCardPoints(deal.hands.north) + highCardPoints(deal.hands.south);
function ready(deal: Deal, targetDeclaringSide: Side) {
  const setup = startMiniBridge({ deal, targetDeclaringSide, learnerSide: 'northSouth' });
  for (let i = 0; i < 100 && setup.seatView('south').step !== 'contract-choice'; i++) setup.advance();
  expect(setup.seatView('south').step).toBe('contract-choice');
  const seat = setup.seatView('south').declarer!, controller = setup.controllerOf(seat);
  expect(setup.submit(seat, controller, { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' }, controller === 'robot'
    ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined).kind).toBe('accepted');
  return setup.playthrough()!;
}
test('US-07.2: clockwise rotation preserves board metadata, records origin and returns after four turns', () => {
  const original = dealFromSeed('role-mix', 3);
  let deal = original;
  for (let rotation = 1; rotation <= 4; rotation++) {
    const next = rotateDeal(deal);
    SEATS.forEach((seat, index) => expect(next.hands[SEATS[(index + 1) % 4]]).toEqual(deal.hands[seat]));
    expect(next.dealId).not.toBe(deal.dealId);
    expect(next.dealId).toBe(dealIdOf(next));
    expect(next.origin).toEqual({ ...original.origin, rotation: rotation % 4 });
    expect(next.dealer).toBe(original.dealer); expect(next.vulnerability).toEqual(original.vulnerability);
    expect(Object.isFrozen(next)).toBe(true);
    deal = next;
    const record = startPlaythrough({ deal, learnerSide: 'northSouth', contract: { declarer: 'south', level: 1, strain: 'no-trumps' } }).record();
    expect(importRecordJson(exportRecordJson(record))).toEqual(record);
  }
  expect(deal).toEqual(original);
  expect(dealFromSeed('role-mix', 3)).toEqual(original);
});
test('US-07.1: 20–20 Redeal precedes rotation and final Announcements', () => {
  let initial = dealFromSeed('role-mix', 1);
  for (let i = 2; nsPoints(initial) !== 20; i++) initial = dealFromSeed('role-mix', i);
  expect(initial.origin.kind).toBe('seed');
  if (initial.origin.kind !== 'seed') throw new Error('Expected seed');
  let next = dealFromSeed(initial.origin.seed, initial.origin.index + 1);
  while (nsPoints(next) === 20) {
    if (next.origin.kind !== 'seed') throw new Error('Expected seed');
    next = dealFromSeed(next.origin.seed, next.origin.index + 1);
  }
  const target = nsPoints(next) > 20 ? 'eastWest' : 'northSouth';
  const table = ready(initial, target), record = table.record(), events = record.setupEvents!;
  const rotation = events.findIndex(event => event.kind === 'rotation');
  expect(rotation).toBeGreaterThan(events.findIndex(event => event.kind === 'redeal'));
  expect(events[rotation]).toEqual({ kind: 'rotation', from: next, to: rotateDeal(next) });
  expect(record.deal).toEqual(rotateDeal(next));
  expect(sideOf(record.contract.declarer)).toBe(target);
  expect(table.seatView('south').announcements).toEqual(SEATS.map((_, index) => {
    const seat = SEATS[(SEATS.indexOf(next.dealer) + index) % 4];
    return { seat, hcp: highCardPoints(record.deal.hands[seat]) };
  }));
  expect(importRecordJson(exportRecordJson(record))).toEqual(record);
});
function rotatedRecord() {
  const deal = dealFromSeed('role-mix', 3);
  const table = ready(deal, nsPoints(deal) > 20 ? 'eastWest' : 'northSouth');
  for (let i = 0; i < 52; i++) {
    const seat = table.seatView('south').turn!, controller = table.controllerOf(seat);
    table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined);
  }
  return table.completedRecord();
}
test('US-07.2: rotated MiniBridge JSON and PBN preserve Deal and setup history', () => {
  const record = rotatedRecord();
  expect(record.deal.origin).toMatchObject({ rotation: 1 });
  expect(importRecordJson(exportRecordJson(record))).toEqual(JSON.parse(exportRecordJson(record)));
  expect(importPbn(exportPbn(record))).toMatchObject({ deal: record.deal, setupEvents: record.setupEvents, contract: record.contract, result: record.result });
});
test.each([-1, 0, 2, 3, 4, 0.5, '1', null])('US-07.2: rejects tampered rotation %s', rotation => {
  const record = rotatedRecord();
  const changed = { ...record, deal: { ...record.deal, origin: { ...record.deal.origin, rotation } } };
  expect(() => importRecordJson(JSON.stringify(changed))).toThrow(/JSON parse error/);
});
test('US-07.2: rejects altered rotation setup events in JSON and PBN', () => {
  const record = rotatedRecord();
  const setupEvents = record.setupEvents!.map(event => event.kind === 'rotation'
    ? { ...event, to: { ...event.to, origin: { ...event.to.origin, rotation: 0 } } } : event);
  expect(() => importRecordJson(JSON.stringify({ ...record, setupEvents }))).toThrow(/setup history/);
  const pbn = exportPbn(record), tag = pbn.match(/\[BridgeVibeSetup ("(?:\\.|[^"\\])*")\]/)!;
  const payload = JSON.parse(JSON.parse(tag[1]));
  payload.setupEvents = setupEvents;
  expect(() => importPbn(pbn.replace(tag[0], `[BridgeVibeSetup ${JSON.stringify(JSON.stringify(payload))}]`))).toThrow(/PBN parse error/);
});
