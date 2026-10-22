import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

// #36: `clock.pauseAt(new Date())` can land in the page clock's past on a slow machine and fail the run.
// Every paused clock goes through installPausedClock, which pauses later than its fixed install time.
const dir = new URL('./e2e/', import.meta.url);
const specs = readdirSync(dir).filter(name => name.endsWith('.ts'));

test('e2e specs pause the clock only through installPausedClock', () => {
  const offenders = specs.filter(name => name !== 'miniBridge.ts' && /\.pauseAt\(/.test(readFileSync(new URL(name, dir), 'utf8')));
  expect(offenders).toEqual([]);
});

test('installPausedClock installs at a fixed time and pauses later than it', () => {
  const helper = readFileSync(new URL('miniBridge.ts', dir), 'utf8');
  expect(helper).toMatch(/clock\.install\(\{ time \}\)/);
  expect(helper).toMatch(/clock\.pauseAt\(time \+ \d+\)/);
});
