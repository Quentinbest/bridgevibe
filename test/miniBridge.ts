import { expect, vi } from 'vitest';
import type { createPlay } from '../src/app/play';

// US-06: retain the previous card-play scenarios by explicitly choosing NT game.
export function choosePractice(play: ReturnType<typeof createPlay>) {
  vi.advanceTimersByTime(3000);
  expect(play.getSnapshot().setup?.step).toBe('contract-choice');
  expect(play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' })).toBe(true);
}
