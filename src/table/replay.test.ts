import { expect, test } from 'vitest';
import fixed from '../../test/fixtures/records/fixed.json';
import fixedPbn from '../../test/fixtures/records/fixed.pbn?raw';
import handwritten from '../../test/fixtures/records/column-order.pbn?raw';
import { completedRecord, exportPbn, exportRecordJson, importPbn, importRecordJson, replay, RULES_CORE_VERSION, SEATS, startPlaythrough } from './index';

const record = importRecordJson(JSON.stringify(fixed));
const complete = completedRecord(record);

test('US-16.1: completion capability is guarded at runtime and at the type boundary', () => {
  const table = startPlaythrough(record);
  expect(() => table.completedRecord()).toThrow(/completed/);
  expect(() => completedRecord(table.record())).toThrow(/completed/);
  // @ts-expect-error §4.3.5: plain records do not carry Table's completion capability.
  expect(() => replay(table.record())).toThrow(/completed/);
  // @ts-expect-error §4.2: clients cannot construct the private brand.
  const forged: import('./index').CompletedPlaythroughRecord = record;
  expect(forged).toBe(record);
});
test('US-04.1: versions are owned snapshots; accepted actions retain ordered provenance', () => {
  const versions = { appVersion: 'test', engineVersions: { policy: '1' } };
  const table = startPlaythrough({ ...record, versions });
  versions.engineVersions.policy = '2';
  for (const entry of record.actions) {
    const provenance = entry.controller === 'robot' ? { kind: 'robot' as const, policy: 'policy', version: '1', durationMs: 3 } : { kind: 'learner' as const };
    expect(table.submit(entry.seat, entry.controller, entry.action, provenance).kind).toBe('accepted');
  }
  const saved = table.completedRecord();
  expect(saved).toMatchObject({ schemaVersion: 2, appVersion: 'test', rulesCoreVersion: RULES_CORE_VERSION, engineVersions: { policy: '1' }, status: 'completed' });
  expect(saved.actions.map(entry => entry.index)).toEqual(Array.from({ length: 52 }, (_, index) => index));
  expect(saved.actions.every(entry => entry.provenance?.kind === entry.controller)).toBe(true);
  expect(saved.deal).toEqual(record.deal);
  expect(saved.contract).toEqual(record.contract);
});
test('ADR-0002, INV-13: every replay position comes only from the recorded actions', () => {
  const tricks = replay(complete);
  expect(tricks.flatMap(trick => trick.cards)).toEqual(record.actions.map(entry => ({ seat: entry.seat, card: entry.action.card })));
  for (const [index, trick] of tricks.entries()) {
    for (const seat of SEATS) {
      const played = record.actions.slice(0, index * 4).filter(entry => entry.seat === seat).map(entry => JSON.stringify(entry.action.card));
      expect(trick.hands[seat]).toEqual(record.deal.hands[seat].filter(card => !played.includes(JSON.stringify(card))));
    }
  }
  const changed = completedRecord({ ...record, engineVersions: { policy: '999' }, actions: record.actions.map(entry => ({ ...entry,
    provenance: entry.controller === 'robot' ? { kind: 'robot', policy: 'replacement', version: '999', durationMs: 5 } : { kind: 'learner' } })) });
  expect(replay(changed)).toEqual(tricks);
  expect(() => replay(completedRecord({ ...record, actions: record.actions.slice(1) }))).toThrow(/index/);
  expect(() => replay(completedRecord({ ...record, actions: record.actions.map((entry, index) => index ? entry :
    { ...entry, action: { kind: 'play-card', card: record.deal.hands.north[0] } }) }))).toThrow(/Illegal record action/);
  expect(() => replay(completedRecord({ ...record, actions: [] }))).toThrow(/status or result/);
  const initial = startPlaythrough(record).record();
  expect(importRecordJson(exportRecordJson(initial))).toEqual(initial);
});
test('US-04.3: JSON is lossless; PBN preserves deal, contract and played sequence', () => {
  expect(importRecordJson(exportRecordJson(record))).toEqual(record);
  for (const text of [fixedPbn, handwritten]) {
    const imported = importPbn(text);
    const roundTrip = importPbn(exportPbn(imported));
    expect(roundTrip.deal).toEqual(imported.deal);
    expect(roundTrip.contract).toEqual(imported.contract);
    expect(replay(roundTrip)).toEqual(replay(imported));
  }
  expect(replay(importPbn(fixedPbn))).toEqual(replay(complete));
  expect(importPbn(fixedPbn).engineVersions).toEqual({});
});
test('PBN 2.1 §3.6: hand-checked fixed columns survive a change of leader', () => {
  // West leads S2; North wins SA and leads SJ. Others are void and discard.
  // Columns stay W,N,E,S: CK SJ HJ DQ, while play order is N,E,S,W.
  const tricks = replay(importPbn(handwritten));
  expect(tricks.map(trick => trick.winner)).toEqual(Array(13).fill('north'));
  expect(tricks[1].cards).toEqual([
    { seat: 'north', card: { suit: 'spades', rank: 'J' } }, { seat: 'east', card: { suit: 'hearts', rank: 'J' } },
    { seat: 'south', card: { suit: 'diamonds', rank: 'Q' } }, { seat: 'west', card: { suit: 'clubs', rank: 'K' } },
  ]);
  expect(exportPbn(importPbn(handwritten))).toContain('CK SJ HJ DQ');
});
test('US-04.3: malformed JSON schemas, deals, actions and provenance are rejected', () => {
  const invalid = [null, { ...fixed, schemaVersion: 1 }, { ...fixed, contract: { ...fixed.contract, level: 8 } },
    { ...fixed, deal: { ...fixed.deal, hands: { ...fixed.deal.hands, west: fixed.deal.hands.east } } },
    { ...fixed, actions: fixed.actions.map((entry, index) => index ? entry : { ...entry, action: { kind: 'play-card', card: { suit: 'bad', rank: 'A' } } }) },
    { ...fixed, actions: fixed.actions.map(entry => ({ ...entry, provenance: { kind: 'robot' } })) },
    { ...fixed, status: 'in-progress' }, { ...fixed, result: { northSouth: 13, eastWest: 0 } }];
  for (const value of invalid) expect(() => importRecordJson(JSON.stringify(value))).toThrow(/JSON parse error/);
  expect(() => importRecordJson('{')).toThrow(/JSON parse error/);
});
test('US-04.3: malformed PBN tags, duplicate cards and illegal play are rejected', () => {
  for (const text of ['', handwritten.replace('[Result "13"]', '[Result "12"]'), handwritten.replace('[Play "W"]', '[Play W]'),
    handwritten.replace('AJT9876543', 'AAT9876543'), handwritten.replace('CK SJ HJ DQ', 'SJ CK HJ DQ'),
    handwritten.replace('S2 SA SK SQ', 'S2 SA SK ZZ'), handwritten.replace('[Declarer "S"]', ''),
    handwritten.replace('[Contract "1NT"]', '[Contract "8NT"]')]) {
    expect(() => importPbn(text)).toThrow(/PBN parse error/);
  }
});
