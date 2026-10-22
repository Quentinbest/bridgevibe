// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from './App';
import { Home } from './Home';
import { fullFollowSuit } from '../curriculum/content';
import { sessionAttempts } from '../progress/attemptStore';

afterEach(() => { cleanup(); vi.useRealTimers(); history.replaceState(null, '', '/'); });

test('Home opens on Learn with accessible declared progress and session-only copy', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'BridgeVibe' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Your next move' })).toBe(document.activeElement);
  const progress = screen.getByRole('progressbar', { name: 'Lesson steps done this session' });
  expect(progress.getAttribute('value')).toBe('0');
  expect(progress.getAttribute('max')).toBe('3');
  expect(progress.getAttribute('aria-valuetext')).toBe('0 of 3 learning steps done this session');
  const lessonCard = screen.getByRole('link', { name: /Skill: Follow suit.*Follow suit.*Open lesson/ });
  expect(lessonCard.contains(progress)).toBe(true);
  expect(screen.getByRole('heading', { name: 'Follow suit' })).toBeTruthy();
  expect(screen.getByText('Skill: Follow suit')).toBeTruthy();
  expect(screen.queryByText(/Level [0-9]/)).toBeNull();
  expect(screen.getByText('About 4 min left')).toBeTruthy();
  expect(screen.getByText(/0 deals played this session/)).toBeTruthy();
  expect(screen.getByText(/Nothing is saved after a reload/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Learn' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('link', { name: /Rules|Me/ })).toBeNull();
});

test('Quick deal and Practice open real MiniBridge Setup; Exit returns focus to Home without counting an unfinished Deal', () => {
  vi.useFakeTimers(); render(<StrictMode><App /></StrictMode>);
  for (const name of [/^Quick deal/, /^Practice$/]) {
    fireEvent.click(screen.getByRole('link', { name }));
    expect(screen.getByRole('heading', { name: 'MiniBridge Setup' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(screen.getByRole('heading', { name: 'Your next move' })).toBe(document.activeElement);
    expect(screen.getByText(/0 deals played this session/)).toBeTruthy();
    expect(location.search).toBe('');
  }
});

test('the lesson card opens the multi-exercise lesson and closes to Home', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /Skill: Follow suit.*Follow suit.*Open lesson/ }));
  expect(location.search).toBe('?lesson=follow-suit-full');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('16');
  expect(screen.queryByRole('navigation')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close lesson' }));
  expect(screen.getByRole('heading', { name: 'Your next move' })).toBe(document.activeElement);
});

test('UX §2.3: the current Learn tab stays on the Learn landing instead of starting the lesson', () => {
  render(<App />);
  const learn = screen.getByRole('link', { name: 'Learn' });
  expect(learn.getAttribute('aria-current')).toBe('page');
  fireEvent.click(learn);
  expect(location.search).toBe('');
  expect(screen.getByRole('heading', { name: 'Your next move' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Close lesson' })).toBeNull();
});

test.each(['?seed=abc&deal=3', '?seed=&deal=1', '?lesson=follow-suit', '?lesson=follow-suit-full', '?practice=1'])('direct URL %s bypasses Home', search => {
  history.replaceState(null, '', `/${search}`); render(<App />);
  expect(screen.queryByRole('heading', { name: 'Your next move' })).toBeNull();
  expect(screen.getByRole('heading', { name: search.includes('lesson') ? 'Follow suit' : 'MiniBridge Setup' })).toBeTruthy();
  if (search.includes('seed=&')) expect(screen.getByRole('status').textContent).toBe('Invalid seed link. Showing the practice deal.');
});

test('browser history restores the matching screen and Home focus', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: /^Quick deal/ }));
  act(() => { history.replaceState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.getByRole('heading', { name: 'Your next move' })).toBe(document.activeElement);
});

test('session Attempts count each declared learning step once, and session count is rendered', () => {
  const prompt = fullFollowSuit.exercises[0].steps.find(step => step.kind === 'prompt')!;
  if (prompt.kind !== 'prompt') throw new Error('Missing Prompt');
  for (let index = 0; index < 2; index++) sessionAttempts.append({ learnerId: 'session-learner', promptContentId: prompt.prompt.contentId,
    version: 1, outcome: 'correct', hintTier: 'none', hintTiming: null, time: index, playthroughId: `home-${index}` });
  sessionAttempts.append({ learnerId: 'session-learner', promptContentId: 'unrelated', version: 1, outcome: 'correct', hintTier: 'none', hintTiming: null, time: 3, playthroughId: 'unrelated' });
  render(<Home dealsPlayed={3} navigate={() => {}} />);
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
  expect(screen.getByText('1 of 3 learning steps done this session')).toBeTruthy();
  expect(screen.getByText('About 3 min left')).toBeTruthy();
  expect(screen.getByText(/3 deals played this session/)).toBeTruthy();
});

test('US-07.1: practice launched again from Home continues the alternation', () => {
  vi.useFakeTimers(); render(<StrictMode><App /></StrictMode>);
  // Launch 1 is Playthrough 0 (the authored Deal); Exit, then launch 2 is Playthrough 1, so the
  // following New deal is Playthrough 2, which targets North–South (a reset count would give East–West).
  fireEvent.click(screen.getByRole('link', { name: /^Quick deal/ }));
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
  fireEvent.click(screen.getByRole('link', { name: /^Quick deal/ }));
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'New deal' }));
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByText(/(North|South|East|West) declares/).textContent).toMatch(/(North|South) declares/);
  vi.useRealTimers();
});

test('the current Learn tab adds no history entry, and launcher hrefs keep query context', () => {
  history.replaceState(null, '', '/?debug=1');
  render(<App />);
  const before = history.length;
  fireEvent.click(screen.getByRole('link', { name: 'Learn' }));
  expect(history.length).toBe(before);
  expect(location.search).toBe('?debug=1');
  expect(screen.getByRole('link', { name: 'Practice' }).getAttribute('href')).toBe('/?debug=1&practice=1');
  expect(screen.getByRole('link', { name: /Skill: Follow suit.*Open lesson/ }).getAttribute('href')).toBe('/?debug=1&lesson=follow-suit-full');
  history.replaceState(null, '', '/');
});
