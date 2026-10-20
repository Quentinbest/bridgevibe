// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { completeFixedDeal } from '../../test/strategy';
import { completedRecord } from '../table';
import { cardName } from '../explanation';
import { createPlay } from './play';
import { App } from './App';
import { ReviewScreen } from './ReviewScreen';

afterEach(() => { cleanup(); vi.useRealTimers(); });
test('US-16.1: the composition API refuses early review and the UI has no entry', () => {
  expect(() => createPlay().completedRecord()).toThrow(/completed/);
  render(<App />);
  expect(screen.queryByRole('button', { name: 'Hand review' })).toBeNull();
  expect(screen.queryByRole('note')).toBeNull();
});
test('US-16: completed composition opens review and returns to the table', () => {
  vi.useFakeTimers(); render(<App />);
  for (const entry of completeFixedDeal().actions) {
    if (entry.controller === 'robot') act(() => vi.advanceTimersByTime(500));
    else {
      const card = screen.getByRole('button', { name: `${cardName(entry.action.card)}, playable` });
      fireEvent.click(card); fireEvent.click(card);
    }
    if (entry.index % 4 === 3) act(() => vi.advanceTimersByTime(1000));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Hand review' }));
  expect(screen.getByRole('heading', { name: 'Hand review' })).toBe(document.activeElement);
  expect(screen.getByRole('note').textContent).toContain('X-ray view: now you can see all 4 hands');
  fireEvent.click(screen.getByRole('button', { name: 'Back to table' }));
  expect(screen.getByRole('button', { name: 'Hand review' })).toBeTruthy();
});
test('US-16.2: stepper, winner and start-of-trick hands follow the completed record', () => {
  render(<ReviewScreen record={completedRecord(completeFixedDeal())} onBack={() => {}} />);
  expect(screen.getByRole('button', { name: 'Previous trick' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Show all 4 hands' }));
  expect(screen.getByRole('region', { name: 'Hands as trick 1 began' }).querySelectorAll('[aria-label]')).toHaveLength(56);
  fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
  expect(screen.getByText('Trick 2 of 13')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Hands as trick 2 began' }).querySelectorAll('[aria-label]')).toHaveLength(52);
  for (let n = 2; n < 13; n++) fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
  expect(screen.getByRole('button', { name: 'Next trick' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous trick' }));
  expect(screen.getByText('Trick 12 of 13')).toBeTruthy();
});
