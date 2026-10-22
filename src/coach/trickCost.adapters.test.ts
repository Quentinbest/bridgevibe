import { expect, test } from 'vitest';
import { completeFixedDeal } from '../../test/strategy';
import { completedRecord } from '../table';
import { bridgeDdsAdapter } from '../analysis/bridgeDdsAdapter';
import { macroxueAdapter } from '../analysis/macroxueAdapter';
import { createProvenanceLog } from './provenance';
import { trickCosts } from './trickCost';

// US-17.2 / §5.2: equal outcomes must not hide non-equivalent Decisions in review.
test('both real adapters produce the same review Decisions and trick costs', async () => {
  const record = completedRecord(completeFixedDeal());
  const reviews: { positionIndex: number; cost: number }[][] = [];
  for (const adapter of [bridgeDdsAdapter, macroxueAdapter]) {
    const costs: typeof reviews[number] = [];
    await trickCosts(record, adapter, createProvenanceLog(), `parity-${adapter.name}`, cost => `X-ray view: with all cards visible. ${cost}`,
      ({ positionIndex, cost }) => costs.push({ positionIndex, cost }));
    expect(costs.filter(cost => cost.positionIndex < 4)).toHaveLength(2);
    reviews.push(costs);
  }
  expect(reviews[1]).toEqual(reviews[0]);
}, 60000);
