// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { text } from '../explanation';
import { createPlay } from './play';
import { TableScreen } from './App';
import { fixedDeal } from './fixture';
import { runHint, type HintRunner } from './hintClient';
import { LessonScreen } from './LessonScreen';
import { followSuit } from '../curriculum/content';
import type { Lesson } from '../curriculum/model';

vi.mock('./hintClient', async importOriginal => ({ ...await importOriginal<typeof import('./hintClient')>(),
  runHint: vi.fn(() => { throw new Error('Computed lesson hint reached'); }) }));

afterEach(() => { cleanup(); vi.useRealTimers(); });
function Harness({ play }: { play: ReturnType<typeof createPlay> }) {
  const view = useSyncExternalStore(play.subscribe, play.getSnapshot);
  return <TableScreen view={view} play={play.play} clearRejection={play.clearRejection} info={fixedDeal} invalid={false}
    onNew={vi.fn()} chooseContract={play.chooseContract} onHint={play.showHint} onDismissHint={play.dismissHint} onToggleHints={play.toggleHints} />;
}

test('US-14.11: learner contract choice offers Hint, shows not covered and remains choosable', () => {
  vi.useFakeTimers(); const runner = vi.fn<HintRunner>(() => vi.fn());
  const play = createPlay({}, fixedDeal, 'northSouth', runner);
  const stop = play.start(); render(<Harness play={play} />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: text('hint.button') }));
  expect(screen.getByRole('alert').textContent).toBe(text('hint.not-covered'));
  expect(screen.getByText(text('hint.choose-contract'))).toBeTruthy();
  expect(runner).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: text('hint.dismiss') }));
  fireEvent.click(screen.getByRole('button', { name: text('setup.choose') }));
  expect(play.getSnapshot().setup).toBeNull();
  stop();
});

test('US-14.12: a delayed hint after a card play never appears in the sheet at the new position', () => {
  vi.useFakeTimers(); const cancel = vi.fn();
  let reply!: Parameters<HintRunner>[2];
  const play = createPlay({}, fixedDeal, 'northSouth', (_view, _cards, done) => { reply = done; return cancel; });
  const stop = play.start(); render(<Harness play={play} />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: text('setup.choose') }));
  act(() => vi.advanceTimersByTime(500));
  const stale = reply;
  fireEvent.click(screen.getByRole('button', { name: text('hint.button') }));
  expect(screen.getByText(text('hint.thinking'))).toBeTruthy();
  const card = screen.getByRole('button', { name: 'Ace of spades, playable' });
  fireEvent.click(card); fireEvent.click(card);
  expect(cancel).toHaveBeenCalledOnce();
  // A faulty runner can still invoke its callback after cancellation.
  act(() => stale({ classes: [{ cards: [{ suit: 'spades', rank: 'A' }], tricks: 13 }], sampleCount: 50, enumerated: false }, 1500));
  expect(screen.queryByRole('region', { name: text('hint.button') })).toBeNull();
  expect(screen.queryByText(text('hint.advice', { card: 'Ace of spades' }))).toBeNull();
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: text('hint.button') }));
  expect(screen.getByText(text('hint.thinking'))).toBeTruthy();
  expect(screen.queryByText(text('hint.advice', { card: 'Ace of spades' }))).toBeNull();
  expect(play.provenanceLog.entries().filter(entry => entry.summary === 'hint.advice')).toHaveLength(0);
  stop();
});


test.each([true, false])('US-14.10: exposed lesson UI never reaches computed hints (authored: %s)', authored => {
  vi.useFakeTimers(); vi.mocked(runHint).mockClear();
  const exercise = followSuit.exercises[0];
  const lesson: Lesson = { ...followSuit, exercises: [{ ...exercise, steps: [
    { kind: 'exposure', cards: [{ seat: 'west', card: exercise.deal.hands.west[0] }] },
    ...exercise.steps.slice(1).map(step => step.kind === 'prompt' ? { ...step,
      prompt: { ...step.prompt, hint: authored ? step.prompt.hint : undefined } } : step),
  ] }] };
  const { container } = render(<LessonScreen lesson={lesson} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  act(() => vi.advanceTimersByTime(500)); act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText('Shown for this lesson')).toBeTruthy();
  if (authored) {
    fireEvent.click(screen.getByRole('button', { name: text('lesson.hint') }));
    expect(screen.getByText(text('lesson.hint-text'))).toBeTruthy();
  } else expect(screen.queryByRole('button', { name: text('lesson.hint') })).toBeNull();
  fireEvent.keyDown(container.firstElementChild!, { key: 'h' });
  expect(runHint).not.toHaveBeenCalled();
  expect(screen.queryByText(text('hint.thinking'))).toBeNull();
  expect(screen.queryByRole('region', { name: text('hint.button') })).toBeNull();
});
