// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { text } from '../explanation';
import { App } from './App';
import { createPlay } from './play';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function rejectCard() {
  const queen = screen.getByRole('button', { name: "Queen of hearts, can't play: you must follow spades" });
  fireEvent.click(queen); fireEvent.click(queen);
  return queen;
}
test('US-01.9: real Table rejection fills the Template and preserves the position', () => {
  vi.useFakeTimers();
  const play = createPlay(); const stop = play.start(); vi.advanceTimersByTime(500);
  const before = play.getSnapshot();
  play.play('north', { suit: 'hearts', rank: 'Q' });
  expect(play.getSnapshot()).toMatchObject({ reason: 'Not that one. You still have spades.', reasonCode: 'must-follow-suit', positionIndex: before.positionIndex, hand: before.hand, dummy: before.dummy, displayedTrick: before.displayedTrick });
  vi.advanceTimersByTime(60000);
  expect(play.getSnapshot().reason).toBe('Not that one. You still have spades.');
  play.clearRejection(); expect(play.getSnapshot().reason).toBe(''); stop();
});
for (const nextAction of ['raise', 'play', 'Escape'] as const) {
  test(`UX §3.4: disclosure preserves feedback; ${nextAction} clears it`, () => {
    vi.useFakeTimers(); render(<App />); act(() => vi.advanceTimersByTime(500));
    const queen = rejectCard();
    expect(queen.classList.contains('rejected-card')).toBe(true);
    expect(queen.getAttribute('aria-pressed')).toBe('false');
    const live = document.querySelector('[aria-live="assertive"]')!;
    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(1);
    expect(live.textContent).toBe('Not that one. You still have spades.');
    const disclosure = screen.getByRole('button', { name: 'Why is that the rule?' });
    const rule = document.getElementById(disclosure.getAttribute('aria-controls')!)!;
    expect(disclosure.getAttribute('aria-expanded')).toBe('false'); expect(rule.hidden).toBe(true);
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true'); expect(rule.hidden).toBe(false);
    expect(rule.textContent).toBe(text('rule.must-follow-suit')); expect(live.contains(rule)).toBe(false);
    act(() => vi.advanceTimersByTime(60000)); expect(live.textContent).not.toBe('');
    fireEvent.click(disclosure); expect(rule.hidden).toBe(true);
    fireEvent.click(disclosure);
    if (nextAction === 'Escape') fireEvent.keyDown(disclosure, { key: 'Escape' });
    else {
      const ace = screen.getByRole('button', { name: 'Ace of spades, playable' });
      fireEvent.click(ace);
      if (nextAction === 'play') fireEvent.click(ace);
    }
    expect(live.textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Why is that the rule?' })).toBeNull();
    expect(queen.classList.contains('rejected-card')).toBe(false);
    if (nextAction !== 'play') {
      rejectCard();
      expect(screen.getByRole('button', { name: 'Why is that the rule?' }).getAttribute('aria-expanded')).toBe('false');
    }
  });
}

for (const dismissal of ['Escape', 'raise'] as const) {
  test(`UX §10: ${dismissal} restores focused disclosure to the rejected card and arrow navigation`, () => {
    vi.useFakeTimers(); render(<App />); act(() => vi.advanceTimersByTime(500));
    const queen = rejectCard();
    // Keep the roving tab stop elsewhere, so restoring only that stop would fail.
    const ace = screen.getByRole('button', { name: 'Ace of spades, playable' });
    act(() => ace.focus());
    const disclosure = screen.getByRole('button', { name: 'Why is that the rule?' });
    act(() => disclosure.focus());
    expect(document.activeElement).toBe(disclosure);
    // Toggling the disclosure must not move focus back to the cards.
    fireEvent.click(disclosure); expect(document.activeElement).toBe(disclosure);
    if (dismissal === 'Escape') fireEvent.keyDown(disclosure, { key: 'Escape' });
    else fireEvent.click(ace);
    expect(screen.queryByRole('button', { name: 'Why is that the rule?' })).toBeNull();
    expect(document.activeElement).toBe(queen);
    fireEvent.keyDown(queen, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: "4 of hearts, can't play: you must follow spades" }));
  });
}

test('UX §3.4: consecutive rejections of the same card restart its animation', () => {
  vi.useFakeTimers(); render(<App />); act(() => vi.advanceTimersByTime(500));
  const queen = screen.getByRole('button', { name: "Queen of hearts, can't play: you must follow spades" });
  const animation = { cancel: vi.fn(), play: vi.fn() };
  Object.defineProperty(queen, 'getAnimations', { value: () => [animation] });
  rejectCard();
  const first = queen.getAttribute('data-rejection-id');
  expect(first).toBe('1');
  expect(animation.cancel).toHaveBeenCalledTimes(1);
  expect(animation.play).toHaveBeenCalledTimes(1);
  rejectCard();
  expect(queen.getAttribute('data-rejection-id')).toBe('2');
  expect(animation.cancel).toHaveBeenCalledTimes(2);
  expect(animation.play).toHaveBeenCalledTimes(2);
  expect(queen.classList.contains('rejected-card')).toBe(true);
});
