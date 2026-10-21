// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { completeFixedDeal, fixedPlaythrough } from '../../test/strategy';
import { completedRecord, sameCard, SEATS, type CompletedPlaythroughRecord } from '../table';
import { bridgeDdsEngine, type PositionResult, type SolverPort } from '../analysis';
import { createProvenanceLog } from '../coach/provenance';
import { cardName } from '../explanation';
import { createAnalysisHost } from './analysisHost';
import { ReviewScreen } from './ReviewScreen';
import { App } from './App';
import { analysisClient } from './analysisClient';

vi.mock('./analysisClient', () => ({ analysisClient: vi.fn(() => ({
  solver: { ...bridgeDdsEngine, solvePosition: vi.fn(async () => ({ ...bridgeDdsEngine, classes: [] })), solveTable: vi.fn() }, at: vi.fn(), close: vi.fn(),
})) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

test('§4.5: completion requests analysis before Hand review opens, never during play or lesson', async () => {
  vi.useFakeTimers(); render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  expect(analysisClient).not.toHaveBeenCalled();
  for (const entry of completeFixedDeal().actions) {
    expect(analysisClient).not.toHaveBeenCalled();
    if (entry.controller === 'robot') act(() => vi.advanceTimersByTime(500));
    else {
      const card = screen.getByRole('button', { name: `${cardName(entry.action.card)}, playable` });
      fireEvent.click(card); fireEvent.click(card);
    }
    if (entry.index % 4 === 3) act(() => vi.advanceTimersByTime(1000));
  }
  vi.useRealTimers();
  await waitFor(() => expect(analysisClient).toHaveBeenCalledOnce());
  expect(screen.queryByRole('heading', { name: 'Hand review' })).toBeNull();
  expect(vi.mocked(analysisClient).mock.calls[0][0].status).toBe('completed');
  fireEvent.click(screen.getByRole('button', { name: 'Hand review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to table' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hand review' }));
  expect(analysisClient).toHaveBeenCalledOnce();
  cleanup(); vi.clearAllMocks();
  window.history.replaceState(null, '', '?lesson=follow-suit');
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Follow suit' })).toBeTruthy();
  expect(analysisClient).not.toHaveBeenCalled();
  window.history.replaceState(null, '', '/');
});

test('US-17: skeleton, progressive neutral/X-ray badges, accessible provenance and versioned cache', async () => {
  const record = completedRecord(completeFixedDeal()); const host = createAnalysisHost(); const log = createProvenanceLog();
  const waiting: (() => void)[] = [];
  const solvePosition = vi.fn<SolverPort['solvePosition']>((layout, position) => new Promise<PositionResult>(resolve => {
    const seat = SEATS[(SEATS.indexOf(position.leader) + position.currentTrick.length) % 4];
    const led = position.currentTrick[0]?.card.suit;
    const following = layout[seat].filter(card => card.suit === led);
    const legal = following.length ? following : layout[seat];
    const chosen = record.actions[52 - Object.values(layout).reduce((n, cards) => n + cards.length, 0)].action.card;
    waiting.push(() => resolve({ ...bridgeDdsEngine, classes: legal.map(card => ({ cards: [card], tricks: sameCard(card, chosen) && seat === 'north' ? 6 : 8 })) }));
  }));
  const fake = { ...bridgeDdsEngine, solvePosition, solveTable: vi.fn() };
  function Review() {
    const analysis = useSyncExternalStore(host.subscribe, () => host.snapshot(record));
    return <ReviewScreen record={record} analysis={analysis} onBack={() => {}} />;
  }
  host.start(record, log, fake); render(<Review />);
  expect(screen.getByRole('status').textContent).toBe('Working out the X-ray view…');
  expect(document.querySelectorAll('.review-cost')).toHaveLength(0);
  host.start(record, log, fake); expect(solvePosition).toHaveBeenCalledOnce();
  await act(async () => { waiting.shift()!(); });
  expect(host.snapshot(record).costs).toHaveLength(1);
  expect(host.snapshot(record).costs[0].cost).toBe(2);
  expect(document.querySelectorAll('.review-cost-xray')).toHaveLength(1);
  expect(document.querySelector('.review-cost b')?.textContent).toBe('−2');
  expect(screen.getByRole('status')).toBeTruthy();
  await act(async () => { waiting.shift()!(); });
  expect(document.querySelector('.review-cost-neutral b')?.textContent).toBe('0');
  expect(document.querySelectorAll('.review-cost')).toHaveLength(2);
  for (const badge of document.querySelectorAll('.review-cost')) {
    expect(badge.textContent).toContain('X-ray view: with all cards visible');
    expect(badge.getAttribute('aria-label')).toContain('bridge-dds, version 1.4.0 / DDS 2.9');
  }
  while (waiting.length) await act(async () => { waiting.shift()!(); });
  expect(screen.queryByRole('status')).toBeNull();
  const calls = solvePosition.mock.calls.length;
  host.start(record, log, fake); expect(solvePosition).toHaveBeenCalledTimes(calls);
  const otherEngine = { ...fake, version: 'next' };
  act(() => host.start(record, createProvenanceLog(), otherEngine));
  expect(solvePosition).toHaveBeenCalledTimes(calls + 1);
  while (waiting.length) await act(async () => { waiting.shift()!(); });
  const otherRecord = completedRecord({ ...record, playthroughId: record.playthroughId + '-another' });
  act(() => host.start(otherRecord, createProvenanceLog(), fake));
  expect(solvePosition.mock.calls.length).toBeGreaterThan(calls + 1);
  while (waiting.length) await act(async () => { waiting.shift()!(); });
});

test('ADR-0001: the host refuses an in-progress record before invoking any solver', () => {
  const host = createAnalysisHost();
  // @ts-expect-error ADR-0001: runtime callers cannot evade the completion guard.
  expect(() => host.start(fixedPlaythrough().record(), createProvenanceLog())).toThrow(/completed/);
  expect(analysisClient).not.toHaveBeenCalled();
});
test('US-17 / #21: failure ends the skeleton without inventing badges', async () => {
  const host = createAnalysisHost(); const record: CompletedPlaythroughRecord = completedRecord(completeFixedDeal());
  host.start(record, createProvenanceLog(), { ...bridgeDdsEngine, solveTable: vi.fn(), solvePosition: vi.fn().mockRejectedValue(new Error('failed')) });
  await waitFor(() => expect(host.snapshot(record)).toEqual({ running: false, costs: [] }));
});

// §4.7: replacing the completed deal cancels its analysis; nothing half-done is cached or published.
test('cancelling an in-flight analysis stops it and drops the unfinished result', async () => {
  const host = createAnalysisHost(); const record = completedRecord(completeFixedDeal());
  let release: () => void = () => {};
  const solvePosition = vi.fn<SolverPort['solvePosition']>(() => new Promise(resolve => {
    release = () => resolve({ ...bridgeDdsEngine, classes: [{ cards: [], tricks: 0 }, { cards: [], tricks: 0 }] });
  }));
  const cancel = host.start(record, createProvenanceLog(), { ...bridgeDdsEngine, solvePosition, solveTable: vi.fn() });
  await vi.waitFor(() => expect(solvePosition).toHaveBeenCalledOnce());
  expect(host.snapshot(record).running).toBe(true);
  cancel();
  expect(host.snapshot(record)).toEqual({ running: false, costs: [] });
  release(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(solvePosition).toHaveBeenCalledOnce();
  expect(host.snapshot(record)).toEqual({ running: false, costs: [] });
});
