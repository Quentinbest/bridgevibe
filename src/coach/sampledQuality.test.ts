import { expect, test } from 'vitest';
import { sampledQuality, samplingOrder, followedHint, sampledQualityEntry } from './sampledQuality';
import type { DecisionAssessment } from './decisionAssessment';
import { validateEntry } from './provenance';
import { hintStatement } from './hint';

const card = { suit: 'hearts', rank: 'Q' } as const;
const other = { suit: 'hearts', rank: 'A' } as const;
const source: NonNullable<DecisionAssessment['sampling']> = { sourceKind: 'engine', name: 'test', version: '1',
  mode: 'VISIBLE', sampleCount: 50, sampled: { qualitySource: 'sampled', seed: 'visible', seedDerivation: 'seatViewSeed', sampler: 'bv-layout', samplerVersion: '1', enumerated: false } };
const decision = (index = 0, cost = 1, candidatesDiffered = true): DecisionAssessment => ({ positionIndex: index,
  trick: Math.floor(index / 4) + 1, card, quality: 'uncertain', outcome: { positionIndex: index, cost, candidatesDiffered,
    statement: { id: 'cost', playthroughId: 'test', positionIndex: index, kind: 'statement', summary: 'cost', text: 'X-ray cost',
      informationMode: 'ALL_HANDS', provenance: { sourceKind: 'engine', name: 'test', version: '1', mode: 'ALL_HANDS', sampleCount: 0 }, at: '2026-10-25T00:00:00Z' } } });
const estimate = (gap: number, sampleCount = 50, enumerated = false) => ({ classes: [{ cards: [other], tricks: 5 }, { cards: [card], tricks: 5 - gap }], sampleCount, enumerated });

test.each([[0.25, 50, false, 'acceptable'], [0.251, 50, false, 'not-acceptable'],
  [0, 49, false, 'uncertain'], [1, 1, true, 'not-acceptable'], [0.25, 1, true, 'acceptable']] as const)(
  'CI-3: gap %s, count %s, enumerated %s gives %s', (gap, count, enumerated, quality) => {
    const assessed = sampledQuality(decision(), estimate(gap, count, enumerated), source, false);
    expect(assessed.quality).toBe(quality);
    if (quality === 'uncertain') expect(assessed.verdict).toBeUndefined();
  });
test('§4.6.5: positive costs first by trick, then differing zero-cost candidates; labels never enter the queue', () => {
  const labelled = { ...decision(2), labelled: true };
  expect(samplingOrder([decision(20, 9), decision(1, 0), decision(3, 0, false), decision(8), labelled, decision(4)]).map(d => d.positionIndex))
    .toEqual([4, 8, 20, 1]);
  expect(sampledQuality(labelled, estimate(1), source, false)).toBe(labelled);
});
test.each([0, 1])('US-18.8: following a displayed tier (c) class downgrades contradictory quality, cost %s', cost => {
  const d = decision(4, cost);
  const hint = { ...hintStatement({ classes: [{ cards: [card, { suit: 'hearts', rank: 'J' }], tricks: 5 }], sampleCount: 50, enumerated: false },
    { name: 'test', version: '1' }, 10, { templateId: 'hint.advice', text: 'hint' }),
    id: 'shown', positionIndex: 4, playthroughId: 'test', informationMode: 'VISIBLE' as const, at: '2026-10-25T00:00:00Z' };
  expect(followedHint(d, 'test', [hint])).toBe(true);
  expect(followedHint({ ...d, card: { suit: 'hearts', rank: 'J' } }, 'test', [hint])).toBe(true);
  expect(followedHint({ ...d, card: other }, 'test', [hint])).toBe(false);
  expect(followedHint(d, 'another', [hint])).toBe(false);
  expect(followedHint(decision(8), 'test', [hint])).toBe(false);
  expect(followedHint(d, 'test', [])).toBe(false);
  expect(sampledQuality(d, estimate(1), source, false).verdict).toBe(cost ? 'mistake' : 'lucky');
  const assessed = sampledQuality(d, estimate(1), source, followedHint(d, 'test', [hint]));
  expect(assessed).toMatchObject({ quality: 'uncertain', hintFollowed: true });
  expect(assessed.verdict).toBeUndefined();
  const entry = sampledQualityEntry(assessed, 'test', 'The estimate was close.')!;
  expect(entry.summary).toBe('moment.hint-close');
  expect(validateEntry(entry)).toEqual([]);
  expect(entry.informationMode).toBe('VISIBLE');
});
test.each([0, 1])('US-18.4: unavailable and insufficient samples cannot yield lucky or mistake, cost %s', cost => {
  for (const result of [estimate(2, 49), { abstention: { reason: 'unavailable', cause: 'timeout' } as const, sampleCount: 0, enumerated: false } as const]) {
    const assessed = sampledQuality(decision(0, cost), result, source, false);
    expect(assessed.quality).toBe('uncertain'); expect(assessed.verdict).toBeUndefined();
  }
});
