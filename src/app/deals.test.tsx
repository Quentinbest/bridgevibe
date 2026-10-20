// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { dealFromSeed } from '../table';
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
test('session exposes metadata only, preserves URL context, and restarts fixed-contract play', () => {
  history.replaceState(null, '', '/?seed=abc&deal=3&extra=1#table');
  const session = dealSession(dealFromSeed('abc', 3));
  expect(Object.keys(session.info).sort()).toEqual(['dealId', 'origin']);
  const next = session.next();
  expect(next.info).toEqual({ dealId: dealFromSeed('abc', 4).dealId, origin: dealFromSeed('abc', 4).origin });
  expect(location.search).toBe('?seed=abc&deal=4&extra=1');
  expect(location.hash).toBe('#table');
  expect(next.play.getSnapshot()).toMatchObject({ positionIndex: 0, dummy: null, contract: { level: 3, strain: 'no-trumps', declarer: 'south' } });
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
  expect(document.querySelectorAll('.played')).toHaveLength(1);
});
test('invalid link displays catalogue feedback', () => {
  history.replaceState(null, '', '/?seed=bad!&deal=3'); render(<App />);
  expect(screen.getByRole('status').textContent).toBe('Invalid seed link. Showing the practice deal.');
});
