import { expect, test } from 'vitest';
import { tablePositions, seatLabel } from './rotation';

test('UX §3.2: only North declaring turns every seat through 180 degrees', () => {
  const ordinary = { north: 'top', south: 'bottom', east: 'right', west: 'left' };
  for (const declarer of [null, 'south', 'east', 'west'] as const) expect(tablePositions(declarer)).toEqual(ordinary);
  expect(tablePositions('north')).toEqual({ north: 'bottom', south: 'top', east: 'left', west: 'right' });
});
test('UX §3.2: letters and control tags follow true seats', () => {
  expect(seatLabel('north', 'north')).toBe('N · North · You play');
  expect(seatLabel('south', 'north')).toBe('S · South · You play');
  expect(seatLabel('south', 'south')).toBe('S · South · You play');
  expect(seatLabel('south', 'east')).toBe('S · South · You');
  expect(seatLabel('south', null)).toBe('S · South · You');
  expect(seatLabel('east', 'north')).toBe('E · East');
  expect(seatLabel('west', 'north')).toBe('W · West');
});
