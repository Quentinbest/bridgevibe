// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { catalogue, currentLanguageTag, currentLocale, number, text } from '../explanation';
import { devicePreferences, matchLocale } from '../explanation/match';
import { App } from './App';
import { createLocaleController, SHIPPED_LOCALES } from './locale';
import * as deals from './deals';

const spanish = {
  product: { ...catalogue.product, text: 'Producto' },
  'home.next': { ...catalogue['home.next'], text: 'Tu siguiente paso' },
  'hint.button': { ...catalogue['hint.button'], text: 'Pista' },
  'hint.dismiss': { ...catalogue['hint.dismiss'], text: 'Cerrar' },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  history.replaceState(null, '', '/');
  document.documentElement.lang = 'en'; document.title = catalogue.product.text;
});

test('I18N-01.1, E-03: matched boot commits before the first frame', async () => {
  expect(SHIPPED_LOCALES).toEqual(['en']);
  const loading = deferred<typeof spanish>();
  const loader = vi.fn(() => loading.promise);
  const shipped = ['en', 'es'];
  const controller = createLocaleController({ shipped, loaders: { es: loader } });
  const boot = controller.boot(matchLocale(devicePreferences({ languages: ['fr', 'es-MX'] }), shipped));
  expect(loader).toHaveBeenCalledOnce();
  expect(currentLocale()).toBe('en');
  loading.resolve(spanish);
  await boot;
  expect(document.documentElement.lang).toBe('es-419');
  expect(document.title).toBe('Producto');
  const { container } = render(<StrictMode><App controller={controller} /></StrictMode>);
  expect(screen.getByRole('heading', { name: 'Producto' })).toBeTruthy();
  expect(container.textContent).toContain('Tu siguiente paso');
  expect(container.textContent).not.toContain(catalogue['home.next'].text);
  expect(screen.queryByRole('status')).toBeNull();
});

test('I18N-02.1, E-05: switching preserves the Seat View, trick, legal cards, hint sheet and focus', async () => {
  vi.useFakeTimers();
  const sessions = vi.spyOn(deals, 'dealSession');
  history.replaceState(null, '', '/?practice=1');
  const controller = createLocaleController({ shipped: ['en', 'es'], loaders: { es: async () => spanish } });
  await controller.boot('en');
  render(<StrictMode><App controller={controller} /></StrictMode>);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  const sheet = screen.getByRole('region', { name: 'Hint' });
  const focused = sheet.querySelector('button')!;
  focused.focus();
  const play = sessions.mock.results.at(-1)!.value.play;
  const before = play.getSnapshot();
  expect(before.displayedTrick).toHaveLength(1);
  expect(before.legalCards.length).toBeGreaterThan(0);
  const cards = [...document.querySelectorAll('button.card')];
  const log = screen.getByRole('log').innerHTML;
  await act(() => controller.switchTo('es'));
  expect(currentLocale()).toBe('es');
  expect(currentLanguageTag()).toBe('es-419');
  expect(number(1234567)).toBe('1,234,567');
  expect(screen.getByRole('region', { name: 'Pista' })).toBe(sheet);
  expect(document.activeElement).toBe(focused);
  expect(focused.textContent).toBe('Cerrar');
  expect(play.getSnapshot()).toBe(before);
  expect(play.getSnapshot().displayedTrick).toEqual(before.displayedTrick);
  expect(play.getSnapshot().legalCards).toEqual(before.legalCards);
  expect([...document.querySelectorAll('button.card')]).toEqual(cards);
  expect(screen.getByRole('log').innerHTML).toBe(log);
  expect(document.documentElement.lang).toBe('es-419');
  expect(document.title).toBe('Producto');
});

test('E-03: the last request wins even if the first loader resolves last', async () => {
  const first = deferred<typeof spanish>();
  const second = deferred<typeof spanish>();
  const controller = createLocaleController({ shipped: ['en', 'es', 'ja'], loaders: {
    es: () => first.promise, ja: () => second.promise,
  } });
  render(<App controller={controller} />);
  const older = controller.switchTo('es');
  const newer = controller.switchTo('ja');
  await act(async () => { second.resolve({ ...spanish, product: { ...catalogue.product, text: 'Second' } }); await newer; });
  await act(async () => { first.resolve(spanish); await older; });
  expect(controller.getSnapshot()).toEqual({ locale: 'ja', failed: false });
  expect(text('product')).toBe('Second');
  expect(document.title).toBe('Second');
  expect(document.documentElement.lang).toBe('ja');
  expect(screen.queryByRole('status')).toBeNull();
});

test('E-03: failure preserves the committed locale and reports politely; retry clears it', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const controller = createLocaleController({ shipped: ['en', 'es', 'ja'], loaders: {
    es: async () => spanish, ja: async () => { throw new Error('chunk unavailable'); },
  } });
  await controller.boot('es');
  render(<App controller={controller} />);
  document.documentElement.lang = 'ja'; document.title = 'Stale title';
  await act(() => controller.switchTo('ja'));
  expect(currentLocale()).toBe('es');
  expect(controller.getSnapshot()).toEqual({ locale: 'es', failed: true });
  expect(document.documentElement.lang).toBe('es-419');
  expect(document.title).toBe('Producto');
  expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  expect(screen.getByRole('status').textContent).toBe(catalogue['locale.load-failed'].text);
  expect(warn).toHaveBeenCalledOnce();
  await act(() => controller.switchTo('en'));
  expect(screen.queryByRole('status')).toBeNull();
  expect(document.title).toBe(catalogue.product.text);
});

test('E-03: a superseded failure cannot mark a successful switch as failed', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const old = deferred<typeof spanish>();
  const controller = createLocaleController({ shipped: ['en', 'es'], loaders: { es: () => old.promise } });
  const older = controller.switchTo('es');
  await controller.switchTo('en');
  old.reject(new Error('stale chunk')); await older;
  expect(controller.getSnapshot()).toEqual({ locale: 'en', failed: false });
});

test('E-03: a latest failure also discards an older success', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const old = deferred<typeof spanish>();
  const controller = createLocaleController({ shipped: ['en', 'es', 'ja'], loaders: {
    es: () => old.promise, ja: async () => { throw new Error('latest failed'); },
  } });
  await controller.boot('en');
  const older = controller.switchTo('es');
  await controller.switchTo('ja');
  old.resolve(spanish); await older;
  expect(controller.getSnapshot()).toEqual({ locale: 'en', failed: true });
  expect(currentLocale()).toBe('en');
  expect(document.title).toBe(catalogue.product.text);
});

test('I18N-01: an unshipped catalogue cannot be loaded', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const loader = vi.fn(async () => spanish);
  const controller = createLocaleController({ loaders: { es: loader } });
  await controller.switchTo('es');
  expect(loader).not.toHaveBeenCalled();
  expect(controller.getSnapshot()).toEqual({ locale: 'en', failed: true });
});

test('U-21: Traditional Chinese keeps its catalogue ID and uses the Taiwan language tag', async () => {
  const controller = createLocaleController({ shipped: ['en', 'zh-Hant'], loaders: {
    'zh-Hant': async () => ({ product: { ...catalogue.product, text: 'Traditional stub' } }),
  } });
  await controller.boot('en');
  render(<App controller={controller} />);
  await act(() => controller.switchTo('zh-Hant'));
  expect(currentLocale()).toBe('zh-Hant');
  expect(currentLanguageTag()).toBe('zh-Hant-TW');
  expect(controller.getSnapshot().locale).toBe('zh-Hant');
  expect(document.documentElement.lang).toBe('zh-Hant-TW');
  expect(document.title).toBe('Traditional stub');
});

test('E-03, I18N-04: a failed boot renders English with English metadata and failure status', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  document.documentElement.lang = 'es-419'; document.title = 'Stale title';
  const controller = createLocaleController({ shipped: ['en', 'es'], loaders: {
    es: async () => { throw new Error('boot chunk unavailable'); },
  } });
  await controller.boot('es');
  render(<StrictMode><App controller={controller} /></StrictMode>);
  expect(currentLocale()).toBe('en');
  expect(currentLanguageTag()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('BridgeVibe');
  expect(screen.getByRole('heading', { name: 'Your next move' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'BridgeVibe' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe(catalogue['locale.load-failed'].text);
  expect(controller.getSnapshot()).toEqual({ locale: 'en', failed: true });
  expect(warn).toHaveBeenCalledOnce();
});

// E-03, I18N-16: a CJK switch waits for its trimmed font, but never blocks on it.
test('E-03: a CJK switch waits for its fonts and commits anyway after 3 s', async () => {
  vi.useFakeTimers();
  const ready = vi.fn(() => deferred<unknown>().promise);
  const loaders = { ja: async () => ({ product: { ...catalogue.product, text: 'ブリッジ' } }) };
  const controller = createLocaleController({ loaders, shipped: ['en', 'ja'], fonts: { ja: async () => ({ ready }) } });
  const switching = controller.switchTo('ja');
  await vi.advanceTimersByTimeAsync(2900);
  expect(ready).toHaveBeenCalledOnce();
  expect(currentLocale()).toBe('en');
  await vi.advanceTimersByTimeAsync(200);
  await switching;
  expect(currentLocale()).toBe('ja');
  // Review of #153: a font module whose own import stalls is inside the 3 s budget too.
  const stalled = createLocaleController({ loaders, shipped: ['en', 'ja'], fonts: { ja: () => deferred<{ ready?: () => Promise<unknown> }>().promise } });
  await stalled.switchTo('en');
  const stalledSwitch = stalled.switchTo('ja');
  await vi.advanceTimersByTimeAsync(2900);
  expect(currentLocale()).toBe('en');
  await vi.advanceTimersByTimeAsync(200);
  await stalledSwitch;
  expect(currentLocale()).toBe('ja');
  // A font module that fails to load doesn't fail the switch.
  const failing = createLocaleController({ loaders, shipped: ['en', 'ja'], fonts: { ja: () => Promise.reject(new Error('font chunk')) } });
  await failing.switchTo('en'); await failing.switchTo('ja');
  expect(failing.getSnapshot()).toEqual({ locale: 'ja', failed: false });
  // Fonts that arrive in time commit at once.
  const quick = createLocaleController({ loaders, shipped: ['en', 'ja'], fonts: { ja: async () => ({ ready: async () => [] }) } });
  await quick.switchTo('en'); await quick.switchTo('ja');
  expect(currentLocale()).toBe('ja');
});
