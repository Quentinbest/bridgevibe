import { ESLint } from 'eslint';
import { expect, test } from 'vitest';
import type { SeatView } from '../src/table';

// ADR-0001: even a structurally complete literal cannot forge the private brand.
// @ts-expect-error Only Table can provide the non-exported symbol.
const forged: SeatView = { seat: 'south', positionIndex: 0, hand: [], dummy: null, contract: { level: 3, strain: 'no-trumps', declarer: 'south' }, tricks: [], currentTrick: [], turn: 'west', tricksWon: { northSouth: 0, eastWest: 0 }, cardCounts: { north: 13, east: 13, south: 13, west: 13 }, status: 'in-progress' };
void forged;
for (const assertion of ['value as SeatView', '<SeatView>value']) {
  test(`ESLint rejects forged SeatView: ${assertion}`, async () => {
    const [result] = await new ESLint().lintText(`import type { SeatView } from '../table'; declare const value: unknown; export const bad = ${assertion};`, { filePath: 'src/app/boundary.ts' });
    expect(result.messages.some(message => message.ruleId === 'no-restricted-syntax')).toBe(true);
  });
}
for (const name of ['Deal', 'PlaythroughRecord', 'Playthrough', 'startPlaythrough']) {
  test(`ESLint rejects robot imports of ${name}`, async () => {
    const [result] = await new ESLint().lintText(`import type { ${name} } from '../table'; export type Bad = ${name};`, { filePath: 'src/robots/boundary.ts' });
    expect(result.messages.some(message => message.ruleId === 'no-restricted-imports')).toBe(true);
  });
}
test('ESLint lets robots import seat-view types and card helpers', async () => {
  const [result] = await new ESLint().lintText("import { SUITS, RANKS, type SeatView, type Card } from '../table'; export const pick = (view: SeatView): Card | undefined => view.hand.find(card => SUITS.includes(card.suit) && RANKS.includes(card.rank));", { filePath: 'src/robots/boundary.ts' });
  expect(result.messages.filter(message => message.ruleId === 'no-restricted-imports')).toEqual([]);
});
test('ESLint rejects robot namespace and deep imports of table', async () => {
  for (const source of ["import * as table from '../table'; export const t = table;", "import { startPlaythrough } from '../table/playthrough'; export const s = startPlaythrough;"]) {
    const [result] = await new ESLint().lintText(source, { filePath: 'src/robots/boundary.ts' });
    expect(result.messages.some(message => message.ruleId === 'no-restricted-imports')).toBe(true);
  }
});
