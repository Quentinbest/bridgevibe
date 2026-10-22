// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';

// UX §3.2, §10: the inline explanation is shared session state, including remounts.
afterEach(() => { cleanup(); vi.useRealTimers(); history.replaceState(null, '', '/'); });
test('North rotation notice is keyboard dismissible, preserves focus and appears once per session', () => {
  vi.useFakeTimers();
  history.replaceState(null, '', '/?seed=setup-ui&deal=6');
  const first = render(<StrictMode><App /></StrictMode>);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  const notice = screen.getByRole('button', { name: 'Got it' });
  expect(screen.queryByRole('dialog')).toBeNull();
  const explanation = screen.getByText(/North won the contract/);
  expect(explanation.getAttribute('role')).toBe('status');
  expect(notice.getAttribute('aria-describedby')).toBe(explanation.id);
  notice.focus();
  act(() => vi.advanceTimersByTime(500));
  expect(document.activeElement).toBe(notice);
  expect(screen.getByText('Play from South (dummy)')).toBeTruthy();
  fireEvent.click(notice);
  expect(document.activeElement).toBe(document.querySelector('.turn-banner'));
  expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
  const south = document.querySelector('.learner')!;
  const north = document.querySelector('.dummy')!;
  expect(south.getAttribute('data-position')).toBe('top');
  expect(north.getAttribute('data-position')).toBe('bottom');
  expect(document.querySelector('.played-left')?.getAttribute('data-seat')).toBe('east');
  const card = [...south.querySelectorAll<HTMLButtonElement>('button.card')].find(button => button.textContent?.endsWith(', playable'))!;
  card.focus(); fireEvent.keyDown(card, { key: 'Enter' }); fireEvent.keyDown(card, { key: 'Enter' });
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText('Play from North (declarer)')).toBeTruthy();
  expect(north.contains(document.activeElement)).toBe(true);
  first.unmount();
  render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
});
