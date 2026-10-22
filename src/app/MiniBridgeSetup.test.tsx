// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';
import { dealFromSeed, rotateDeal } from '../table';
import { cardName } from '../explanation';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); history.replaceState(null, '', '/'); });
test('US-06, UX §4.2: focus, strain/objective targets, explicit confirmation, and contract-choice Hint', () => {
  vi.useFakeTimers(); const scroll = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  const spades = screen.getByRole('button', { name: 'spades' });
  expect(document.activeElement).toBe(spades);
  fireEvent.click(spades); expect(spades.getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Part-score · 7 tricks' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Game · 10 tricks' }));
  expect(screen.getByRole('button', { name: 'Hint' })).toBeTruthy();
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
  vi.useFakeTimers(); history.replaceState(null, '', `/?seed=setup-ui&deal=${index - 1}`); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'New deal' }));
  act(() => vi.advanceTimersByTime(3500));
  expect(document.querySelectorAll(`.opponent.${dummy} .card`)).toHaveLength(13);
  expect(document.querySelectorAll('.dummy .card')).toHaveLength(0);
  expect(screen.getByText('S · South · You')).toBeTruthy();
  expect(document.querySelector('.contract')?.textContent).not.toBe('');
});
test('ADR-0003: North and South rotate, with correct roles and learner controls', () => {
  vi.useFakeTimers(); history.replaceState(null, '', '/?seed=setup-ui&deal=6'); render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  expect(document.querySelector('.setup-own')?.getAttribute('aria-label')).toBe('South');
  expect(document.querySelector('.setup-own')?.textContent).toContain('S · South · You');
  expect(document.querySelector('.setup-own')?.getAttribute('data-position')).toBe('bottom');
  expect(document.querySelector('.setup-north')?.getAttribute('data-position')).toBe('top');
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText('S · South · You play')).toBeTruthy();
  expect(document.querySelector('.learner')?.getAttribute('data-position')).toBe('top');
  expect(document.querySelector('.dummy')?.getAttribute('data-position')).toBe('bottom');
  const south = [...document.querySelectorAll('.learner button.card')].find(card => card.textContent?.endsWith(', playable'))!;
  fireEvent.click(south); fireEvent.click(south);
  act(() => vi.advanceTimersByTime(500));
  expect(document.querySelector('.dummy')?.getAttribute('aria-label')).toBe('North');
  expect(document.querySelectorAll('.dummy button.card')).toHaveLength(13);
});

// UX §3.2: South's cards, not Declarer's, occupy the bottom throughout every setup phase.
test.each([2, 3, 6, null])('setup keeps South at bottom for seeded index %s', index => {
  vi.useFakeTimers();
  if (index) history.replaceState(null, '', `/?seed=setup-ui&deal=${index}`);
  render(<App />);
  for (let phase = 0; phase <= 6; phase++) {
    const own = document.querySelector('.setup-own')!;
    expect(own.getAttribute('aria-label')).toBe('South');
    expect(own.getAttribute('data-position')).toBe('bottom');
    expect(own.textContent).toContain('S · South · You');
    expect(document.querySelector('.table')).toBeNull();
    expect(document.querySelector('.rotation-notice')).toBeNull();
    expect(document.querySelector('.setup-screen')?.lastElementChild).toBe(own);
    if (index) {
      const names = [...own.querySelectorAll('[role="img"]')].map(card => card.getAttribute('aria-label'));
      expect(names.sort()).toEqual((index === 2 || index === 3 ? rotateDeal(dealFromSeed('setup-ui', index)) : dealFromSeed('setup-ui', index)).hands.south.map(cardName).sort());
    }
    if (phase < 6) act(() => vi.advanceTimersByTime(500));
  }
});
