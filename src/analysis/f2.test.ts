import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SUITS, type Card } from '../table';
import { bridgeDdsAdapter } from './bridgeDdsAdapter';
import { type Layout, type Position } from './index';

type Reference = { table: number[][]; positions: number[][] };
// US-17.4: no skipped cases or substitutes when offline reference generation is pending.
test('F2: 20 tables and 40 mid-play positions agree with native DDS and macroxue', async () => {
  const path = new URL('./f2-smoke.json', import.meta.url);
  if (!existsSync(path)) throw new Error('F2 data missing: run the generator outside the sandbox: node scripts/solver/generate-f2.ts');
  const data = JSON.parse(readFileSync(path, 'utf8')) as { cases: { dealId: string; layout: Layout;
    positions: { layout: Layout; position: Position; legal: string[] }[]; native: Reference; macroxue: Reference }[] };
  expect(data.cases).toHaveLength(20);
  expect(data.cases.flatMap(item => item.positions)).toHaveLength(40);
  expect(new Set(data.cases.flatMap(item => item.positions.map(p => p.position.currentTrick.length)))).toEqual(new Set([0, 1, 2, 3]));
  const code = (card: Card) => 'SHDC'[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
  for (const item of data.cases) {
    const table = await bridgeDdsAdapter.solveTable(item.layout);
    expect(table.table, item.dealId).toEqual(item.native.table);
    expect(table.table, item.dealId).toEqual(item.macroxue.table);
    for (const [i, p] of item.positions.entries()) {
      const result = await bridgeDdsAdapter.solvePosition(p.layout, p.position);
      const scores = new Map(result.classes.flatMap(group => group.cards.map(card => [code(card), group.tricks] as const)));
      expect([...scores.keys()].sort()).toEqual([...p.legal].sort());
      expect(p.legal.map(card => scores.get(card)), `${item.dealId}:${i}`).toEqual(item.native.positions[i]);
      expect(p.legal.map(card => scores.get(card)), `${item.dealId}:${i}`).toEqual(item.macroxue.positions[i]);
    }
  }
}, 60000);
