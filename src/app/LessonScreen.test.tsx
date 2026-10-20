// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LessonScreen } from './LessonScreen';
import { sessionAttempts } from '../progress/attemptStore';
import { followSuit } from '../curriculum/content';
import { cardName } from '../explanation';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function openPrompt() {
  vi.useFakeTimers();
  render(<LessonScreen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  for (let i = 0; i < 3; i++) act(() => { vi.advanceTimersByTime(500); });
}
test('US-21: keyboard selects, cancels, asks for a hint, accepts an alternative and advances progress', () => {
  openPrompt();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 3 of 5');
  const card = screen.getByRole('button', { name: 'King of hearts' });
  fireEvent.keyDown(card, { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Play it, King of hearts' })).toBeTruthy();
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: /^Play it,/ })).toBeNull();
  fireEvent.keyDown(card, { key: 'h' });
  expect(screen.getByText('Authored hint · follow-suit.prompt · version 1')).toBeTruthy();
  fireEvent.keyDown(card, { key: 'Enter' });
  fireEvent.keyDown(card, { key: 'Enter' });
  expect(screen.getByText('Nice. You followed suit. Any of these works: Ace of hearts, King of hearts, Queen of hearts.')).toBeTruthy();
  expect(sessionAttempts.snapshot().at(-1)).toMatchObject({ outcome: 'correct', hintTier: 'a', hintTiming: 'before-first-answer' });
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  expect(screen.getByText('4/5')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('4');
  act(() => { vi.advanceTimersByTime(500); });
  expect(screen.getByText('5/5')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('5');
});
test('US-21: wrong twice exposes Show me, records failure and offers script continuation', () => {
  openPrompt();
  const wrong = screen.getAllByRole('button').find(button => button.dataset.suit === 'spades')!;
  for (let i = 0; i < 2; i++) {
    fireEvent.click(wrong);
    fireEvent.click(screen.getByRole('button', { name: /^Play it,/ }));
    expect(screen.getByText(/Not quite/)).toBeTruthy();
    if (i === 0) expect(screen.queryByRole('button', { name: 'Show me' })).toBeNull();
  }
  expect(screen.getByText('Not that one. You still have hearts.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
  expect(screen.getByText(/These answers follow suit: Ace of hearts, King of hearts, Queen of hearts/)).toBeTruthy();
  expect(sessionAttempts.snapshot().at(-1)?.outcome).toBe('failed');
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  act(() => { vi.advanceTimersByTime(500); });
  expect(screen.getByText('5/5')).toBeTruthy();
});

// UX §3.1, §6.2: the lesson table shows exposed Dummy face up, like the practice table.
test('Dummy is face up in the lesson table after the opening lead', () => {
  openPrompt();
  const dummy = screen.getByRole('region', { name: 'North · Dummy' });
  expect(dummy.querySelectorAll('.card')).toHaveLength(12);
});

// UX §10: scripted plays are announced to screen readers through a polite log.
test('scripted lesson plays are announced in a polite live log', () => {
  openPrompt();
  const log = screen.getByRole('log');
  expect(log.getAttribute('aria-live')).toBe('polite');
  expect(log.textContent).toMatch(/West plays the .* of hearts/);
  expect(log.querySelectorAll('p')).toHaveLength(3);
});

// UX §10: the second wrong answer removes the card controls, so keyboard focus moves to Show me.
test('after the second wrong answer, focus moves to Show me', () => {
  openPrompt();
  const offSuit = followSuit.exercises[0].deal.hands.south.find(card => card.suit !== 'hearts')!;
  for (let attempt = 0; attempt < 2; attempt++) {
    const card = screen.getByRole('button', { name: cardName(offSuit) });
    card.focus();
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: 'Enter' });
  }
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show me' }));
});
