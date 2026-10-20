import { fixedDeal } from './fixture';
import { afterEach, expect, test, vi } from 'vitest';
import { completeFixedDeal } from '../../test/strategy';
import { createPlay } from './play';

afterEach(() => vi.useRealTimers());
test('full fixed Deal with fallback defenders and first-legal learner completes all 13 tricks', () => {
  const record = completeFixedDeal();
  expect(record.actions).toHaveLength(52);
  expect(record.status).toBe('completed');
  expect(record.result).toEqual({ northSouth: 6, eastWest: 7 });
});
test('composition delays blind lead, exposes Dummy, and stops its timers', () => {
  vi.useFakeTimers();
  const play = createPlay({}, fixedDeal);
  expect(play.getSnapshot().dummy).toBeNull();
  const stop = play.start();
  vi.advanceTimersByTime(499);
  expect(play.getSnapshot().positionIndex).toBe(0);
  vi.advanceTimersByTime(1);
  expect(play.getSnapshot()).toMatchObject({ positionIndex: 1, turn: 'north', cardCounts: { west: 12 } });
  expect(play.getSnapshot().dummy).toHaveLength(13);
  play.play('north', play.getSnapshot().legalCards[0]);
  stop(); vi.advanceTimersByTime(1000);
  expect(play.getSnapshot().positionIndex).toBe(2);
});
test('composition retains completed trick for 1 second and gates the next play', () => {
  vi.useFakeTimers(); const play = createPlay({}, fixedDeal); const stop = play.start();
  vi.advanceTimersByTime(500);
  play.play('north', play.getSnapshot().legalCards[0]);
  vi.advanceTimersByTime(500);
  play.play('south', play.getSnapshot().legalCards[0]);
  expect(play.getSnapshot()).toMatchObject({ collecting: true, positionIndex: 4 });
  expect(play.getSnapshot().displayedTrick).toHaveLength(4);
  play.play('north', play.getSnapshot().legalCards[0]);
  expect(play.getSnapshot().positionIndex).toBe(4);
  vi.advanceTimersByTime(999);
  expect(play.getSnapshot().displayedTrick).toHaveLength(4);
  vi.advanceTimersByTime(1);
  expect(play.getSnapshot()).toMatchObject({ collecting: false, displayedTrick: [] }); stop();
});
test('composition retains reason until the next action and publishes each play and winner', () => {
  vi.useFakeTimers(); const play = createPlay({}, fixedDeal); const stop = play.start();
  vi.advanceTimersByTime(500);
  play.play('north', { suit: 'hearts', rank: 'Q' });
  expect(play.getSnapshot().reason).toBe('Not that one. You still have spades.');
  expect(play.getSnapshot().positionIndex).toBe(1);
  vi.advanceTimersByTime(2000);
  expect(play.getSnapshot().reason).toBe('Not that one. You still have spades.');
  play.play('north', play.getSnapshot().legalCards[0]);
  expect(play.getSnapshot().reason).toBe('');
  vi.advanceTimersByTime(500); play.play('south', play.getSnapshot().legalCards[0]);
  expect(play.getSnapshot().announcements).toEqual(['West plays the 9 of spades', 'North plays the Ace of spades', 'East plays the 3 of spades', 'South plays the King of spades']); stop();
});
