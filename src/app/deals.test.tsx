// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed, highCardPoints } from '../table';
import { dealFromUrl, dealSession, nextDeal } from './deals';
import { fixedDeal } from './fixture';
import { App } from './App';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); history.replaceState(null, '', '/'); });
test('URL parses reproducible links and retains the authored default', () => {
  expect(dealFromUrl('?seed=abc&deal=3')).toEqual({ deal: dealFromSeed('abc', 3), invalid: false });
  expect(dealFromUrl('')).toEqual({ deal: fixedDeal, invalid: false });
});
test.each(['?seed=abc', '?deal=1', '?seed=&deal=1', '?seed=a.b&deal=1', '?seed=abc&deal=0', '?seed=abc&deal=1.5', '?seed=abc&deal=1e2', '?seed=abc&deal=9007199254740992', '?seed=a&seed=b&deal=1'])('invalid URL %s falls back', url => {
  expect(dealFromUrl(url)).toEqual({ deal: fixedDeal, invalid: true });
});
test('New deal uses crypto for a fresh 12-character seed from an authored Deal', () => {
  const random = vi.spyOn(crypto, 'getRandomValues');
  const deal = nextDeal(fixedDeal);
  expect(random).toHaveBeenCalledOnce();
  expect(deal.origin).toMatchObject({ kind: 'seed', index: 1 });
  if (deal.origin.kind !== 'seed') throw new Error('Expected seed');
  expect(deal.origin.seed).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect(dealFromSeed(deal.origin.seed, 1)).toEqual(deal);
});
test('US-03: New deal at the terminal index starts a fresh seed', () => {
  const random = vi.spyOn(crypto, 'getRandomValues');
  const deal = nextDeal(dealFromSeed('terminal', Number.MAX_SAFE_INTEGER));
  expect(random).toHaveBeenCalledOnce();
  expect(deal.origin).toMatchObject({ kind: 'seed', index: 1 });
  if (deal.origin.kind !== 'seed') throw new Error('Expected seed');
  expect(deal.origin.seed).toMatch(/^[A-Za-z0-9_-]{12}$/);
  expect(dealFromSeed(deal.origin.seed, 1)).toEqual(deal);
});
test('US-06, US-03: terminal 20–20 link explains that no Redeal is available and New deal recovers', () => {
  let seed: string | undefined;
  for (let i = 0; i < 2000; i++) {
    const candidate = `terminal-${i}`, deal = dealFromSeed(candidate, Number.MAX_SAFE_INTEGER);
    if (highCardPoints(deal.hands.north) + highCardPoints(deal.hands.south) === 20) { seed = candidate; break; }
  }
  if (!seed) throw new Error('Missing terminal 20–20 fixture');
  const search = `?seed=${seed}&deal=${Number.MAX_SAFE_INTEGER}`;
  expect(dealFromUrl(search).invalid).toBe(false);
  vi.useFakeTimers(); history.replaceState(null, '', `/${search}`);
  render(<App />);
  act(() => vi.advanceTimersByTime(2000));
  // US-06.2: a valid link that can't be redealt says so, rather than claiming a fallback.
  expect(screen.getByRole('status').textContent).toBe("Both sides have 20 points, and this link can't be redealt. Choose New deal to play another deal.");
  expect(screen.queryByText('Invalid seed link. Showing the practice deal.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Choose' })).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(30000));
  expect(vi.getTimerCount()).toBe(0);
  // US-03: use a reproducible fresh seed whose first Deal lets the learner choose.
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
    (array as Uint8Array).fill(0); return array;
  });
  fireEvent.click(screen.getByRole('button', { name: 'New deal' }));
  expect(location.search).toBe('?seed=AAAAAAAAAAAA&deal=1');
  expect(screen.queryByRole('status')).toBeNull();
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  expect(document.querySelector('.table')).not.toBeNull();
});
test('session exposes metadata only, preserves URL context, and restarts MiniBridge Setup', () => {
  history.replaceState(null, '', '/?seed=abc&deal=3&extra=1#table');
  const session = dealSession(dealFromSeed('abc', 3));
  expect(Object.keys(session.info).sort()).toEqual(['dealId', 'origin']);
  const next = session.next();
  expect(next.info).toEqual({ dealId: dealFromSeed('abc', 4).dealId, origin: dealFromSeed('abc', 4).origin });
  expect(location.search).toBe('?seed=abc&deal=4&extra=1');
  expect(location.hash).toBe('#table');
  expect(next.play.getSnapshot()).toMatchObject({ positionIndex: 0, dummy: null, contract: null, setup: { step: 'announcements', announcements: [] } });
});
test('New deal replaces active play and cancels the old robot timer', () => {
  vi.useFakeTimers(); history.replaceState(null, '', '/?seed=abc&deal=3');
  render(<App />);
  act(() => vi.advanceTimersByTime(250));
  fireEvent.click(screen.getByRole('button', { name: 'New deal' }));
  expect(location.search).toBe('?seed=abc&deal=4');
  act(() => vi.advanceTimersByTime(250));
  expect(document.querySelectorAll('.played')).toHaveLength(0);
  act(() => vi.advanceTimersByTime(250));
  expect(document.querySelectorAll('.played')).toHaveLength(0);
  expect(document.querySelectorAll('.setup-points li')).toHaveLength(1);
});
test('invalid link displays catalogue feedback', () => {
  history.replaceState(null, '', '/?seed=bad!&deal=3'); render(<App />);
  expect(screen.getByRole('status').textContent).toBe('Invalid seed link. Showing the practice deal.');
});

test('US-06: redeal updates stable metadata without replacing the session or open dialog', () => {
  vi.useFakeTimers();
  const session = dealSession(dealFromSeed('setup-ui', 1));
  const info = session.info, key = session.key, stop = session.play.start();
  expect(session.info).toBe(info);
  vi.advanceTimersByTime(3500);
  expect(session.info).not.toBe(info); expect(session.info).toBe(session.info);
  expect(session.key).toBe(key); stop();
  history.replaceState(null, '', '/?seed=setup-ui&deal=1'); render(<App />);
  // jsdom has no native dialog implementation.
  const element = document.querySelector('dialog')!;
  element.showModal = () => { element.open = true; };
  fireEvent.click(screen.getByRole('button', { name: 'Deal info' }));
  const dialog = screen.getByRole('dialog');
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole('dialog')).toBe(dialog);
  expect(dialog.textContent).toContain(dealFromSeed('setup-ui', 2).dealId);
});
