import { expect, test } from 'vitest';
import { scoreMiniBridge, miniBridgeResult, type MiniBridgeScoreInput } from './miniBridgeScoring';
import { OBJECTIVES } from './miniBridgeRules';
import { SUITS, completedRecord, startPlaythrough, dealFromSeed } from './index';
import fixture from './f6-minibridge.json';

for (const row of fixture.cases) test(`F6 DEP-01 ${JSON.stringify(row)}`, () => {
  expect(scoreMiniBridge(row as MiniBridgeScoreInput).score).toBe(row.score);
});
for (const strain of [...SUITS, 'no-trumps'] as const) for (const objective of OBJECTIVES) {
  for (let tricks = 0; tricks <= 13; tricks++) test(`Laws 16–17 ${strain} ${objective} ${tricks}`, () => {
    const minor = strain === 'clubs' || strain === 'diamonds';
    const goal = objective === 'part-score' ? 7 : strain === 'no-trumps' ? 9 : minor ? 11 : 10;
    const expected = tricks < goal ? (tricks - goal) * 50
      : (tricks - 6) * (minor ? 20 : 30) + (strain === 'no-trumps' ? 10 : 0) + (objective === 'game' ? 300 : 50);
    const actual = scoreMiniBridge({ strain, objective, tricks });
    expect(actual.score).toBe(expected);
    expect(actual.breakdown.reduce((sum, item) => sum + item.amount, 0)).toBe(expected);
    for (const item of actual.breakdown) expect(item.amount).toBe(item.count * item.value);
    if (tricks < goal) expect(actual.breakdown).toEqual([{ kind: 'tricks-short', count: goal - tricks, value: -50, amount: expected }]);
    else {
      expect(actual.breakdown.at(-1)?.kind).toBe(`${objective}-bonus`);
      if (strain === 'no-trumps') expect(actual.breakdown[0]).toEqual({ kind: 'first-no-trump', count: 1, value: 40, amount: 40 });
    }
  });
}
test('US-09.2 rejects invalid untyped inputs', () => {
  const valid = { strain: 'spades', objective: 'game', tricks: 10 };
  for (const input of [null, undefined, 1, ...[-1, 14, 1.5, NaN, Infinity, '10'].map(tricks => ({ ...valid, tricks })),
    { ...valid, strain: 'stars' }, { ...valid, objective: 'slam' }]) {
    expect(() => scoreMiniBridge(input as MiniBridgeScoreInput)).toThrow(RangeError);
  }
});

// ADR-0002: use a real completed Table record; only legacy metadata varies below.
function record() {
  const table = startPlaythrough({ deal: dealFromSeed('result', 1), gameFormat: 'minibridge',
    contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, learnerSide: 'northSouth' });
  while (table.seatView('south').turn) {
    const seat = table.seatView('south').turn!;
    const controller = table.controllerOf(seat);
    table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined);
  }
  return table.record();
}
test('Result derives tricks, side, outcome and score from a completed record', () => {
  const saved = completedRecord(record());
  const result = miniBridgeResult(saved);
  expect(result).toMatchObject({ contract: saved.contract, declarer: 'south', declaringSide: 'northSouth',
    objective: 'game', goal: 9, tricks: saved.result.northSouth, made: saved.result.northSouth >= 9,
    short: Math.max(0, 9 - saved.result.northSouth), overtricks: Math.max(0, saved.result.northSouth - 9) });
  expect(result.score).toEqual(scoreMiniBridge({ strain: 'no-trumps', objective: 'game', tricks: saved.result.northSouth }));
  expect(() => miniBridgeResult(completedRecord({ ...saved, gameFormat: 'contract-bridge' }))).toThrow();
  for (const strain of [...SUITS, 'no-trumps'] as const) for (const objective of OBJECTIVES) {
    const level = objective === 'part-score' ? 1 : strain === 'no-trumps' ? 3 : strain === 'clubs' || strain === 'diamonds' ? 5 : 4;
    expect(miniBridgeResult(completedRecord({ ...saved, contract: { level, strain, declarer: 'east' } })))
      .toMatchObject({ objective, tricks: saved.result.eastWest, declaringSide: 'eastWest' });
  }
  expect(() => miniBridgeResult(completedRecord({ ...saved, contract: { ...saved.contract, level: 2 } }))).toThrow();
  expect(miniBridgeResult(completedRecord({ ...saved, setupEvents: [{ kind: 'contract-choice', seat: 'south', controller: 'learner',
    action: { kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' }, provenance: { kind: 'learner' } }] })))
    .toMatchObject({ objective: 'part-score', goal: 7 });
});
