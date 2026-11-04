// @vitest-environment jsdom
import { useLayoutEffect, useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { catalogue, currentLocale, text } from '../explanation';
import { createLocaleController } from './locale';
import { App } from './App';
import { LessonScreen } from './LessonScreen';
import { ReviewScreen } from './ReviewScreen';
import { completedRecord } from '../table';
import { completeFixedDeal } from '../../test/strategy';
import * as deals from './deals';
import * as hintClient from './hintClient';

const selector = '[aria-live],[role="status"],[role="alert"],[role="log"]';
const originals = () => new Map([...document.querySelectorAll(selector)].map(element => [element, element.getAttribute('aria-live')]));
const expectMuted = (regions: Map<Element, string | null>) => {
  expect(regions.size).toBeGreaterThan(0);
  for (const element of regions.keys()) expect(element.getAttribute('aria-live')).toBe('off');
};
const expectRestored = (regions: Map<Element, string | null>) => {
  for (const [element, original] of regions) expect(element.getAttribute('aria-live')).toBe(original);
};
const spanish = {
  ...catalogue,
  product: { ...catalogue.product, text: 'Producto' },
  'hint.advice': { ...catalogue['hint.advice'], text: 'Consejo: {card}' },
  'reason.must-follow-suit': { ...catalogue['reason.must-follow-suit'], text: 'Sigue {suit}' },
  'turn.dummy-seat': { ...catalogue['turn.dummy-seat'], text: 'Juega del muerto' },
  'review.working': { ...catalogue['review.working'], text: 'Analizando' },
  'review.position': { ...catalogue['review.position'], text: 'Baza {n}' },
  'lesson.watch': { ...catalogue['lesson.watch'], text: 'Observa' },
};
const makeController = () => createLocaleController({ shipped: ['en', 'es'], loaders: { es: async () => spanish } });

function frames() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { pending.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((key: number) => pending.delete(key)));
  return () => {
    const callbacks = [...pending.values()]; pending.clear();
    act(() => callbacks.forEach(callback => callback(0)));
  };
}
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
});

test('I18N §6.3: synchronous React commits mute every existing region and restore exact attributes after two frames', async () => {
  const frame = frames(), controller = makeController();
  const commits: { locale: string; live: (string | null)[]; copy: string }[] = [];
  function Regions() {
    const { locale } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    useLayoutEffect(() => {
      commits.push({ locale, live: [...document.querySelectorAll('[data-existing]')].map(element => element.getAttribute('aria-live')),
        copy: document.querySelector('[data-existing]')!.textContent! });
    }, [locale]);
    return <>
      <p data-existing aria-live="polite">{text('product')}</p>
      <p data-existing aria-live="assertive">{text('product')}</p>
      <p data-existing aria-live="off">{text('product')}</p>
      <p data-existing role="status">{text('product')}</p>
      <p data-existing role="alert">{text('product')}</p>
      <p data-existing role="log">{text('product')}</p>
      {locale === 'es' && <p data-new role="status">{text('product')}</p>}
    </>;
  }
  render(<Regions />);
  const before = originals();
  controller.subscribe(() => {
    expect(currentLocale()).toBe('es'); expectMuted(before);
  });
  await act(async () => {
    await controller.switchTo('es');
    // This must already be committed inside act, not deferred until act flushes React.
    expect(commits.at(-1)).toEqual({ locale: 'es', live: Array(6).fill('off'), copy: 'Producto' });
  });
  expectMuted(before);
  expect(document.querySelector('[data-new]')?.hasAttribute('aria-live')).toBe(false);
  frame(); expectMuted(before);
  frame(); expectRestored(before);
});

test.each([0, 1])('I18N §6.3: a second switch after %s frames inherits originals and cancels the older restoration', async elapsed => {
  const frame = frames(), controller = makeController();
  function Regions() {
    const { locale } = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    return <><p aria-live="assertive">{text('product')}</p><p role="alert">{text('product')}</p>
      {locale === 'es' && <p role="log">{text('product')}</p>}</>;
  }
  render(<Regions />);
  const before = originals();
  await act(() => controller.switchTo('es'));
  if (elapsed) frame();
  const added = screen.getByRole('log');
  expect(added.hasAttribute('aria-live')).toBe(false);
  await act(() => controller.switchTo('en'));
  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
  expectMuted(before);
  frame(); expectMuted(before);
  frame(); expectRestored(before);
  expect(added.hasAttribute('aria-live')).toBe(false);
  expect(document.querySelector('[aria-live="off"]')).toBeNull();
});

test('I18N §6.3: timeout fallback restores originals after rapid switches without animation frames', async () => {
  vi.useFakeTimers(); vi.stubGlobal('requestAnimationFrame', undefined);
  const controller = makeController();
  render(<><p aria-live="polite" /><p role="status" /></>);
  const before = originals();
  await act(() => controller.switchTo('es'));
  act(() => vi.advanceTimersByTime(30)); expectMuted(before);
  await act(() => controller.switchTo('en'));
  act(() => vi.advanceTimersByTime(30)); expectMuted(before);
  act(() => vi.advanceTimersByTime(20)); expectRestored(before);
});

test('I18N §6.3: real table, rejection, hint and log stay muted through translated copy without new announcements', async () => {
  vi.useFakeTimers(); const frame = frames(), controller = makeController();
  vi.spyOn(hintClient, 'runHint').mockImplementation((_view, cards, done) => {
    done({ classes: [{ cards: [cards[0]], tricks: 3 }], sampleCount: 50, enumerated: false }, 0);
    return () => {};
  });
  const sessions = vi.spyOn(deals, 'dealSession');
  history.replaceState(null, '', '/?practice=1');
  render(<App controller={controller} />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  const play = sessions.mock.results.at(-1)!.value.play;
  act(() => play.play('north', { suit: 'hearts', rank: 'Q' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  const before = originals(), announcements = play.getSnapshot().announcements;
  expect(announcements.length).toBeGreaterThan(0);
  const banner = document.querySelector('.turn-banner')!, rejection = document.querySelector('.reason')!;
  const hint = document.querySelector('.hint-sheet [role="status"]')!;
  const log = screen.getByRole('log'), oldLog = log.innerHTML;
  expect([banner, rejection, hint, log].every(element => before.has(element))).toBe(true);
  controller.subscribe(() => expectMuted(before));
  await act(() => controller.switchTo('es'));
  expectMuted(before);
  expect(banner.textContent).toBe('Juega del muerto');
  expect(rejection.textContent).toBe('Sigue spades');
  expect(hint.textContent).toContain('Consejo:');
  expect(play.getSnapshot().announcements).toEqual(announcements);
  expect(log.innerHTML).toBe(oldLog);
  frame(); expectMuted(before); frame(); expectRestored(before);
});

test.each(['lesson', 'review'] as const)('I18N §6.3: %s implicit and explicit live regions retain off through React rendering', async kind => {
  vi.useFakeTimers(); const frame = frames(), controller = makeController();
  const record = completedRecord(completeFixedDeal());
  function Surface() {
    useSyncExternalStore(controller.subscribe, controller.getSnapshot);
    return kind === 'lesson' ? <LessonScreen onClose={() => {}} />
      : <ReviewScreen record={record} analysis={{ running: true, costs: [] }} onBack={() => {}} />;
  }
  render(<Surface />);
  if (kind === 'lesson') fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  const before = originals();
  expect([...before.values()]).toContain(null);
  expect([...before.values()]).toContain('polite');
  controller.subscribe(() => expectMuted(before));
  await act(() => controller.switchTo('es'));
  expectMuted(before);
  expect(screen.getByRole('status').textContent).toBe(kind === 'lesson' ? 'Observa' : 'Analizando');
  if (kind === 'review') expect(screen.getByRole('heading', { name: 'Baza 1' })).toBeTruthy();
  frame(); expectMuted(before); frame(); expectRestored(before);
});

test.each(['advice', 'failure'] as const)('I18N §6.3: an in-flight hint %s during the mute window restores announcements without clobbering React', async result => {
  vi.useFakeTimers(); const frame = frames(), controller = makeController();
  let complete!: () => void;
  vi.spyOn(hintClient, 'runHint').mockImplementation((_view, cards, done) => {
    complete = () => done(result === 'advice'
      ? { classes: [{ cards: [cards[0]], tricks: 3 }], sampleCount: 50, enumerated: false }
      : { abstention: { reason: 'unavailable', cause: 'error' }, sampleCount: 0, enumerated: false }, 10);
    return () => {};
  });
  history.replaceState(null, '', '/?practice=1');
  render(<App controller={controller} />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  const region = document.querySelector('.hint-sheet [role="status"]')!;
  expect(region.getAttribute('aria-busy')).toBe('true');
  expect(region.getAttribute('aria-live')).toBe('polite');
  await act(() => controller.switchTo('es'));
  expect(region.getAttribute('aria-live')).toBe('off');
  const banner = document.querySelector('.turn-banner')!;
  await act(async () => { complete(); });
  // The observer runs before either restoration frame, as soon as new content is committed.
  expect(region.getAttribute('aria-busy')).toBe('false');
  expect(region.getAttribute('aria-live')).toBe(result === 'advice' ? 'polite' : 'assertive');
  expect(region.getAttribute('role')).toBe(result === 'advice' ? 'status' : 'alert');
  expect(region.textContent).toContain(result === 'advice' ? 'Consejo:' : text('hint.unavailable-failure'));
  expect(banner.getAttribute('aria-live')).toBe('off');
  frame(); frame();
  expect(region.getAttribute('aria-live')).toBe(result === 'advice' ? 'polite' : 'assertive');
  expect(banner.getAttribute('aria-live')).toBe('polite');
});

test('I18N §6.3: external attribute changes survive restoration and a newer switch before observer delivery', async () => {
  const frame = frames(), controller = makeController();
  render(<><p aria-live="polite" /><p role="status" /></>);
  const [changed, implicit] = [...document.querySelectorAll(selector)];
  await act(() => controller.switchTo('es'));
  await act(async () => {
    changed.setAttribute('aria-live', 'assertive');
    // English commits synchronously, before the queued mutation observer callback.
    await controller.switchTo('en');
  });
  expect(changed.getAttribute('aria-live')).toBe('off');
  await act(async () => { implicit.removeAttribute('aria-live'); });
  frame(); frame();
  expect(changed.getAttribute('aria-live')).toBe('assertive');
  expect(implicit.hasAttribute('aria-live')).toBe(false);
});
