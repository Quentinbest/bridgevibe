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
for (const name of ['Deal', 'PlaythroughRecord']) {
  test(`ESLint rejects robot imports of ${name}`, async () => {
    const [result] = await new ESLint().lintText(`import type { ${name} } from '../table'; export type Bad = ${name};`, { filePath: 'src/robots/boundary.ts' });
    expect(result.messages.some(message => message.ruleId === 'no-restricted-imports')).toBe(true);
  });
}
