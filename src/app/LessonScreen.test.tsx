// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LessonScreen } from './LessonScreen';
import { sessionAttempts } from '../progress/attemptStore';
import { followSuit } from '../curriculum/content';
import { cardName } from '../explanation';
import { createProvenanceLog, validateEntry } from '../coach/provenance';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function openPrompt() {
  vi.useFakeTimers();
  render(<LessonScreen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  for (let i = 0; i < 2; i++) act(() => { vi.advanceTimersByTime(500); });
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
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next step' }));
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
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('alert').textContent).toBe('Not that one. You still have hearts.');
  expect(screen.getByText('Not that one. You still have hearts.').closest('[role="status"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
  expect(screen.getByText(/These answers follow suit: Ace of hearts, King of hearts, Queen of hearts/)).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next step' }));
  expect(sessionAttempts.snapshot().at(-1)?.outcome).toBe('failed');
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  act(() => { vi.advanceTimersByTime(500); });
  expect(screen.getByText('5/5')).toBeTruthy();
});

// UX §3.1, §6.2: the lesson table shows exposed Dummy face up, like the practice table.
test('Dummy is face up in the lesson table after the opening lead', () => {
  openPrompt();
  const dummy = screen.getByRole('region', { name: 'East · Dummy' });
  expect(dummy.querySelectorAll('.card')).toHaveLength(12);
  expect(within(dummy).getByRole('img', { name: 'King of spades' })).toBeTruthy();
  expect(within(dummy).queryByRole('img', { name: 'Ace of spades' })).toBeNull();
});

// UX §10: scripted plays are announced to screen readers through a polite log.
test('scripted lesson plays are announced in a polite live log', () => {
  openPrompt();
  const log = screen.getByRole('log');
  expect(log.getAttribute('aria-live')).toBe('polite');
  expect(log.textContent).toMatch(/North plays the .* of hearts/);
  expect(log.querySelectorAll('p')).toHaveLength(2);
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

// US-14.4, US-40, CI-5: a shown authored hint is logged as a statement with authored provenance.
test('showing the hint records one authored statement in the provenance log', () => {
  const log = createProvenanceLog('0.0.0');
  vi.useFakeTimers();
  render(<LessonScreen onClose={vi.fn()} provenanceLog={log} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  for (let i = 0; i < 2; i++) act(() => { vi.advanceTimersByTime(500); });
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  const entries = log.entries();
  expect(entries).toHaveLength(1);
  expect(validateEntry(entries[0])).toEqual([]);
  expect(entries[0]).toMatchObject({ kind: 'statement', informationMode: 'VISIBLE',
    provenance: { sourceKind: 'authored', contentId: 'follow-suit.prompt', version: '1' } });
});
// UX §10: after the last scripted play, focus moves to the newly shown continuation.
test('focus moves to Finish level after the scripted play that ends the exercise', () => {
  openPrompt();
  const card = screen.getByRole('button', { name: 'Ace of hearts' });
  fireEvent.keyDown(card, { key: 'Enter' });
  fireEvent.keyDown(card, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  act(() => { vi.advanceTimersByTime(500); });
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Finish level' }));
});

// US-21.6/7, UX §10: full lesson navigation, teaching cards and pressure-free completion.
test('full lesson shows step states and an unplayable exposure, then counts this run and exits', async () => {
  const { fullFollowSuit } = await import('../curriculum/content');
  vi.useFakeTimers();
  const onClose = vi.fn();
  render(<LessonScreen lesson={fullFollowSuit} onClose={onClose} />);
  for (let exercise = 0; exercise < 3; exercise++) {
    const list = screen.getByRole('list');
    expect(list.querySelectorAll('li')).toHaveLength(16);
    expect(list.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(list.querySelector('[data-state="upcoming"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    if (exercise === 1) {
      const exposed = screen.getByText('Shown for this lesson').closest('figure')!;
      expect(within(exposed).getByRole('img', { name: '4 of hearts' })).toBeTruthy();
      expect(within(exposed).queryByRole('button')).toBeNull();
      expect(exposed.closest('section')?.getAttribute('aria-label')).toBe('West');
      expect(list.querySelector('[data-state="done"]')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    }
    for (let i = 0; i < 2; i++) act(() => { vi.advanceTimersByTime(500); });
    if (exercise === 1) {
      const wrong = screen.getByRole('button', { name: '6 of spades' });
      fireEvent.keyDown(wrong, { key: 'Enter' }); fireEvent.keyDown(wrong, { key: 'Enter' });
    }
    const card = screen.getByRole('button', { name: 'Ace of hearts' });
    fireEvent.keyDown(card, { key: 'Enter' }); fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByText('Shown for this lesson')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: exercise === 2 ? 'Finish level' : 'Next step' }));
  }
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Level complete' }));
  expect(screen.getByText('Right first time').nextElementSibling?.textContent).toBe('2');
  expect(screen.getByText('After a nudge (that counts too)').nextElementSibling?.textContent).toBe('1');
  expect(screen.getByText('Skill unlocked: Follow suit')).toBeTruthy();
  expect(screen.getByRole('main').textContent).not.toMatch(/score|star|streak|mastery/i);
  fireEvent.click(screen.getByRole('button', { name: 'Next: Practice following suit' }));
  fireEvent.click(screen.getByRole('button', { name: "That's enough for today" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

// US-02.3, UX §3.2: unpublished content exercises real player projection and keyboard controls.
test('North-declared lesson puts North at bottom and plays South dummy then North', async () => {
  const { northLesson } = await import('../../test/fixtures/northLesson');
  vi.useFakeTimers();
  render(<LessonScreen lesson={northLesson} onClose={() => {}} />);
  const north = document.querySelector('[data-seat="north"][data-position="bottom"]')!;
  expect(north.textContent).toContain('N · North · You play');
  act(() => vi.advanceTimersByTime(500));
  const south = document.querySelector('[data-seat="south"][data-position="top"]')!;
  expect(south.textContent).toContain('S · South · You play');
  expect(document.querySelector('.lesson-trick .played-left')?.getAttribute('data-seat')).toBe('east');
  expect(screen.getByText('Play from South (dummy)')).toBeTruthy();
  const dummyPrompt = northLesson.exercises[0].steps.filter(step => step.kind === 'prompt')[0].prompt;
  const dummyCard = within(south as HTMLElement).getByRole('button', { name: cardName(dummyPrompt.expectedAnswers[0]) });
  fireEvent.keyDown(dummyCard, { key: 'Enter' }); fireEvent.keyDown(dummyCard, { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText('Play from North (declarer)')).toBeTruthy();
  const prompt = northLesson.exercises[0].steps.filter(step => step.kind === 'prompt')[1].prompt;
  const card = within(north as HTMLElement).getByRole('button', { name: cardName(prompt.expectedAnswers[0]) });
  fireEvent.keyDown(card, { key: 'Enter' }); fireEvent.keyDown(card, { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Finish level' })).toBeTruthy();
});
