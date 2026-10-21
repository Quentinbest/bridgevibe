// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); history.replaceState(null, '', '/'); });
test('US-06, UX §4.2: focus, strain/objective targets, explicit confirmation, and no Hint', () => {
  vi.useFakeTimers(); const scroll = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  const spades = screen.getByRole('button', { name: 'spades' });
  expect(document.activeElement).toBe(spades);
  fireEvent.click(spades); expect(spades.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Part-score · 7 tricks' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Game · 10 tricks' }));
  expect(screen.queryByRole('button', { name: /Hint/ })).toBeNull();
  expect(document.querySelector('.contract')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  expect(scroll).toHaveBeenCalledOnce();
  expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  delete (Element.prototype as Partial<Element>).scrollIntoView;
  expect(screen.getByText('South declares · 10 tricks')).toBeTruthy();
  expect(screen.getByText('♠ Game')).toBeTruthy();
  expect(document.querySelectorAll('.dummy .card')).toHaveLength(13);
  act(() => vi.advanceTimersByTime(500));
  expect(document.querySelector('.dummy')?.contains(document.activeElement)).toBe(true);
});
for (const [index, dummy] of [[2, 'east'], [3, 'west']] as const) test(`US-06: robot choice places exposed dummy in ${dummy}`, () => {
  vi.useFakeTimers(); history.replaceState(null, '', `/?seed=setup-ui&deal=${index}`); render(<App />);
  act(() => vi.advanceTimersByTime(3500));
  expect(document.querySelectorAll(`.opponent.${dummy} .card`)).toHaveLength(13);
  expect(document.querySelectorAll('.dummy .card')).toHaveLength(0);
  expect(screen.getByText('South · You · Defender')).toBeTruthy();
  expect(document.querySelector('.contract')?.textContent).not.toBe('');
});
test('ADR-0003: North and South remain in place, with correct roles and learner controls', () => {
  vi.useFakeTimers(); history.replaceState(null, '', '/?seed=setup-ui&deal=6'); render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  expect(document.querySelector('.setup-own')?.getAttribute('aria-label')).toBe('North');
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText('South · You play Dummy')).toBeTruthy();
  const south = [...document.querySelectorAll('.learner button.card')].find(card => card.textContent?.endsWith(', playable'))!;
  fireEvent.click(south); fireEvent.click(south);
  act(() => vi.advanceTimersByTime(500));
  expect(document.querySelector('.dummy')?.getAttribute('aria-label')).toBe('North');
  expect(document.querySelectorAll('.dummy button.card')).toHaveLength(13);
});
