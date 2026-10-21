import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SUITS, type Card } from '../table';
import { bridgeDdsAdapter } from './bridgeDdsAdapter';
import { macroxueAdapter } from './macroxueAdapter';
import { type CardClass, type Layout, type Position } from './index';

type Reference = { table: number[][]; positions: number[][] };
// US-17.4: no skipped cases or substitutes when offline reference generation is pending.
const suites = [bridgeDdsAdapter, macroxueAdapter].flatMap(adapter => [
  { adapter, name: adapter.name, file: 'f2-smoke.json', deals: 20, positions: 40, command: '' },
  { adapter, name: adapter.name, file: 'f2-full.json', deals: 100, positions: 200, command: ' --full' },
]);
test.each(suites)('F2 $name $file: every table and legal card agrees with both references', async ({ adapter, file, deals, positions, command }) => {
  const path = new URL(`./${file}`, import.meta.url);
  if (!existsSync(path)) throw new Error(`F2 data missing: run outside the sandbox: node scripts/solver/generate-f2.ts${command}`);
  const data = JSON.parse(readFileSync(path, 'utf8')) as { cases: { dealId: string; layout: Layout;
    positions: { layout: Layout; position: Position; legal: string[] }[]; native: Reference; macroxue: Reference }[] };
  expect(data.cases).toHaveLength(deals);
  expect(data.cases.flatMap(item => item.positions)).toHaveLength(positions);
  expect(new Set(data.cases.flatMap(item => item.positions.map(p => p.position.currentTrick.length)))).toEqual(new Set([0, 1, 2, 3]));
  const code = (card: Card) => 'SHDC'[SUITS.indexOf(card.suit)] + (card.rank === '10' ? 'T' : card.rank);
  const canonical = (classes: readonly CardClass[]) => classes.map(group => JSON.stringify({
    cards: group.cards.map(code).sort(), tricks: group.tricks,
  })).sort();
  for (const item of data.cases) {
    const table = await adapter.solveTable(item.layout);
    expect(table).toMatchObject({ name: adapter.name, version: adapter.version });
    expect(table.table, item.dealId).toEqual(item.native.table);
    expect(table.table, item.dealId).toEqual(item.macroxue.table);
    for (const [i, p] of item.positions.entries()) {
      const result = await adapter.solvePosition(p.layout, p.position);
      const reference = await bridgeDdsAdapter.solvePosition(p.layout, p.position);
      expect(canonical(result.classes), `${item.dealId}:${i}:equivalence`).toEqual(canonical(reference.classes));
      expect(result).toMatchObject({ name: adapter.name, version: adapter.version });
      const entries = result.classes.flatMap(group => group.cards.map(card => [code(card), group.tricks] as const));
      expect(entries).toHaveLength(p.legal.length);
      const scores = new Map(entries);
      expect([...scores.keys()].sort()).toEqual([...p.legal].sort());
      expect(p.legal.map(card => scores.get(card)), `${item.dealId}:${i}`).toEqual(item.native.positions[i]);
      expect(p.legal.map(card => scores.get(card)), `${item.dealId}:${i}`).toEqual(item.macroxue.positions[i]);
    }
  }
}, 180000);
