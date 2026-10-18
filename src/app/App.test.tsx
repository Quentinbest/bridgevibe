// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { cardName } from '../explanation';
import { completeFixedDeal } from '../../test/strategy';
import { App } from './App';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
test('real composition and React controls play all 52 cards under StrictMode', () => {
  vi.useFakeTimers();
  render(<StrictMode><App /></StrictMode>);
  expect(screen.queryByRole('button', { name: 'Ace of spades, playable' })).toBeNull();
  for (const entry of completeFixedDeal().actions) {
    if (entry.controller === 'robot') advance(500);
    else {
      const region = screen.getByRole('region', { name: entry.seat === 'north' ? 'North · Dummy' : 'Your hand' });
      const button = within(region).getByRole('button', { name: `${cardName(entry.action.card)}, playable` });
      expect(region.contains(document.activeElement)).toBe(true);
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Play it' }));
    }
    if (entry.index % 4 === 3) advance(1000);
  }
  expect(screen.getByText('You took 6 of 13 tricks (needed 9)')).toBeTruthy();
  // 52 card plays; trick winners are announced by the banner, not the log.
  expect(screen.getByRole('log').children).toHaveLength(52);
});
test('off-suit rejection lowers the selected card and roving arrows and Escape preserve the hand', () => {
  vi.useFakeTimers(); render(<App />); advance(500);
  const queen = screen.getByRole('button', { name: "Queen of hearts, can't play: you must follow spades" });
  fireEvent.click(queen); fireEvent.click(queen);
  expect(queen.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('Play spades; you still have that suit.').getAttribute('aria-live')).toBe('assertive');
  const ace = screen.getByRole('button', { name: 'Ace of spades, playable' });
  fireEvent.keyDown(ace, { key: 'ArrowRight' });
  const five = screen.getByRole('button', { name: '5 of spades, playable' });
  expect(document.activeElement).toBe(five);
  fireEvent.click(five); fireEvent.keyDown(five, { key: 'Escape' });
  expect(five.getAttribute('aria-pressed')).toBe('false');
  expect(screen.queryByRole('button', { name: 'Play it' })).toBeNull();
  expect(within(screen.getByRole('region', { name: 'North · Dummy' })).getAllByRole('button')).toHaveLength(13);
});

test('keyboard play of the last card retains a focused tab stop on the next active turn', () => {
  vi.useFakeTimers(); render(<App />); advance(500);
  function playFirstLegal() {
    const button = screen.getAllByRole('button').find(button => button.querySelector('.sr-only')?.textContent?.endsWith(', playable'))!;
    fireEvent.click(button); fireEvent.click(button);
  }
  playFirstLegal(); advance(500); playFirstLegal(); advance(1000);
  const dummy = screen.getByRole('region', { name: 'North · Dummy' });
  const before = within(dummy).getAllByRole('button');
  // UX §10: wrap left to the last card, then raise and play it with Enter.
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(before.at(-1));
  expect(before.at(-1)?.querySelector('.sr-only')?.textContent).toBe('4 of clubs, playable');
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  expect(before.at(-1)?.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
  advance(500); playFirstLegal(); advance(500); advance(1000);
  playFirstLegal(); advance(500);
  const remaining = within(dummy).getAllByRole('button');
  expect(remaining).toHaveLength(before.length - 1);
  const tabStops = remaining.filter(button => button.tabIndex === 0);
  expect(tabStops).toEqual([remaining.at(-1)]);
  expect(document.activeElement).toBe(tabStops[0]);
});

test('collection announces the winner before the next lead banner', () => {
  vi.useFakeTimers(); render(<App />); advance(500);
  const ace = screen.getByRole('button', { name: 'Ace of spades, playable' });
  fireEvent.click(ace); fireEvent.click(ace); advance(500);
  const king = screen.getByRole('button', { name: 'King of spades, playable' });
  fireEvent.click(king); fireEvent.click(king);
  const banner = document.querySelector('.turn-banner')!;
  expect(banner.textContent).toBe('North wins the trick');
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  advance(999); expect(banner.textContent).toBe('North wins the trick');
  advance(1); expect(banner.textContent).toBe("Dummy's lead");
  expect(within(screen.getByRole('region', { name: 'North · Dummy' })).getAllByRole('button')).toHaveLength(12);
});
