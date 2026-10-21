// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createPlay } from './play';
import DebugPanel from './DebugPanel';

afterEach(() => { cleanup(); vi.useRealTimers(); });
test('ADR-0001, US-40.2: selecting a seat displays its current view throughout setup and play', () => {
  vi.useFakeTimers(); const play = createPlay(); const stop = play.start();
  function Panel() { useSyncExternalStore(play.subscribe, play.getSnapshot); return <DebugPanel play={play} />; }
  render(<Panel />);
  const view = () => JSON.parse(document.querySelector('#debug-seat-view')!.textContent!);
  fireEvent.click(screen.getByRole('button', { name: 'Show seat view' }));
  expect(view()).toMatchObject({ seat: 'east', step: 'announcements', dummy: null });
  fireEvent.click(screen.getByRole('button', { name: 'Show seat view' }));
  fireEvent.change(screen.getByLabelText('Seat'), { target: { value: 'north' } });
  expect(view()).toMatchObject({ seat: 'north', step: 'announcements' });
  act(() => vi.advanceTimersByTime(3000));
  expect(view().dummy).toHaveLength(13); expect(view().step).toBe('contract-choice');
  act(() => { play.chooseContract({ kind: 'choose-contract', strain: 'spades', objective: 'game' }); });
  expect(view()).toMatchObject({ seat: 'north', positionIndex: 0 });
  act(() => vi.advanceTimersByTime(500));
  for (const seat of ['south', 'east', 'west', 'north']) {
    fireEvent.change(screen.getByLabelText('Seat'), { target: { value: seat } });
    expect(view()).toMatchObject({ seat, positionIndex: 1 });
  }
  stop();
});
