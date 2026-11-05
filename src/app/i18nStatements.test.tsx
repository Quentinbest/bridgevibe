// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { catalogue, catalogueVersion, currentLocale, setLocale, text } from '../explanation';
import * as provenance from '../coach/provenance';
import { bridgeDdsEngine, type SolverPort } from '../analysis';
import { SEATS } from '../table';
import { choosePractice } from '../../test/miniBridge';
import { f4Position, finish, points } from '../../test/f4/records';
import { createPlay } from './play';
import { App } from './App';
import { createLocaleController } from './locale';
import * as deals from './deals';
import * as hintClient from './hintClient';
import { createAnalysisHost } from './analysisHost';
import { ReviewScreen } from './ReviewScreen';
import { LessonScreen } from './LessonScreen';
import { renderCopy } from './copy';

const stub = {
  ...catalogue,
  'hint.advice': { ...catalogue['hint.advice'], text: 'Consejo: {card}' },
  'hint.reason': { ...catalogue['hint.reason'], text: 'Razón' },
  'hint.forced-card': { ...catalogue['hint.forced-card'], text: 'Forzada: {card}' },
  'hint.forced-class': { ...catalogue['hint.forced-class'], text: 'Forzadas: {cards}' },
  'reason.must-follow-suit': { ...catalogue['reason.must-follow-suit'], text: 'Sigue {suit}' },
  'card.name': { ...catalogue['card.name'], text: 'Carta {rank} de {suit}' },
  'suit.spades': { ...catalogue['suit.spades'], text: 'picas' },
  'review.announcements': { ...catalogue['review.announcements'], text: 'Anuncios' },
  'review.declarer-dummy': { ...catalogue['review.declarer-dummy'], text: 'Declarante y muerto' },
  'review.contract-choice': { ...catalogue['review.contract-choice'], text: 'Contrato' },
  'review.cost-description': { ...catalogue['review.cost-description'], text: 'Coste {cost} ({name}, {version}). Vista completa.' },
  'review.unavailable': { ...catalogue['review.unavailable'], text: 'No disponible' },
};
const controller = () => createLocaleController({ shipped: ['en', 'es'], loaders: { es: async () => stub } });
const runner: hintClient.HintRunner = (_view, cards, done) => {
  done({ classes: [{ cards: [cards[0]], tricks: 3 }], sampleCount: 50, enumerated: false }, 10);
  return () => {};
};
// US-40: the solver seam supplies legal classes; the Table and all coaching logic remain real.
function solver(): SolverPort {
  return { ...bridgeDdsEngine, solveTable: vi.fn(), solvePosition: vi.fn<SolverPort['solvePosition']>(async (layout, position) => {
    const seat = SEATS[(SEATS.indexOf(position.leader) + position.currentTrick.length) % 4];
    const following = layout[seat].filter(card => card.suit === position.currentTrick[0]?.card.suit);
    const cards = following.length ? following : layout[seat];
    return { ...bridgeDdsEngine, classes: cards.map((card, index) => ({ cards: [card], tricks: index % 2 })) };
  }) };
}
function finishPractice(play: ReturnType<typeof createPlay>) {
  for (let n = 0; n < 200 && play.getSnapshot().status !== 'completed'; n++) {
    const view = play.getSnapshot();
    if (!view.collecting && view.legalCards.length && (view.turn === 'north' || view.turn === 'south')) {
      play.showHint(); play.play(view.turn, view.legalCards[0]);
    } else vi.advanceTimersByTime(1000);
  }
  return play.completedRecord();
}
function expectStamped(entries: provenance.LogEntry[]) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(provenance.validateEntry(entry)).toEqual([]);
    if (entry.text !== undefined) expect(entry).toMatchObject({ locale: 'en', catalogueVersion: catalogueVersion() });
    if (entry.kind === 'robot-action') {
      expect(entry).not.toHaveProperty('locale'); expect(entry).not.toHaveProperty('catalogueVersion');
    }
  }
}
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks();
  history.replaceState(null, '', '/');
});

test('E-02: resolved hint and rejection switch together without requesting, logging or announcing again', async () => {
  vi.useFakeTimers();
  const requests = vi.spyOn(hintClient, 'runHint').mockImplementation(runner);
  const sessions = vi.spyOn(deals, 'dealSession');
  const locale = controller(); await locale.boot('en');
  history.replaceState(null, '', '/?practice=1');
  render(<App controller={locale} />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  act(() => vi.advanceTimersByTime(500));
  const play = sessions.mock.results.at(-1)!.value.play;
  act(() => play.play('north', { suit: 'hearts', rank: 'Q' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  expect(screen.getByText('Not that one. You still have spades.')).toBeTruthy();
  const sheet = screen.getByRole('region', { name: 'Hint' });
  expect(sheet.textContent).toContain('From what you can see');
  const entries = play.provenanceLog.entries(), announcements = screen.getByRole('log').innerHTML;
  const requestsBefore = requests.mock.calls.length;
  expect(requestsBefore).toBeGreaterThan(0);
  await act(() => locale.switchTo('es'));
  expect(sheet.textContent).toContain('Consejo: Carta');
  expect(sheet.textContent).toContain('picas');
  expect(sheet.textContent).toContain('Razón');
  expect(screen.getByText('Sigue picas')).toBeTruthy();
  expect(requests).toHaveBeenCalledTimes(requestsBefore);
  expect(play.provenanceLog.entries()).toEqual(entries);
  expect(screen.getByRole('log').innerHTML).toBe(announcements);
});

test('E-17: a forced hint computed while closed renders and stamps the locale at opening', () => {
  vi.useFakeTimers();
  const requests = vi.fn(runner);
  const play = createPlay({}, undefined, 'northSouth', requests);
  const stop = play.start(); choosePractice(play);
  for (let n = 0; n < 200; n++) {
    const view = play.getSnapshot();
    if (view.hint?.advice?.id === 'hint.forced-card') break;
    if (!view.collecting && view.legalCards.length && (view.turn === 'north' || view.turn === 'south')) play.play(view.turn, view.legalCards[0]);
    else vi.advanceTimersByTime(1000);
  }
  const hint = play.getSnapshot().hint!;
  expect(hint).toMatchObject({ open: false, thinking: false, advice: { id: 'hint.forced-card' } });
  const oldText = renderCopy(hint.advice!), calls = requests.mock.calls.length;
  setLocale('es', stub);
  play.showHint();
  const entry = play.provenanceLog.entries().at(-1)!;
  expect(entry.text).toBe(renderCopy(hint.advice!));
  expect(entry.text).toMatch(/^Forzada: Carta/);
  expect(entry.text).not.toBe(oldText);
  expect(entry).toMatchObject({ locale: 'es', catalogueVersion: catalogueVersion() });
  expect(requests).toHaveBeenCalledTimes(calls);
  stop();
});

test('US-40, I18N-20.1: practice, review, unavailable and default lesson logs stamp every text source', async () => {
  vi.useFakeTimers();
  const play = createPlay({}, undefined, 'northSouth', runner), stop = play.start();
  vi.advanceTimersByTime(3000); play.showHint();
  play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' });
  play.play('south', play.getSnapshot().hand[0]); play.showRule();
  const record = finishPractice(play); stop();
  const log = play.provenanceLog;
  const summaries = log.entries().map(entry => entry.summary);
  for (const id of ['hint.not-covered', 'not-your-turn', 'hint.advice', 'hint.forced-card']) expect(summaries).toContain(id);
  expect(log.entries().some(entry => entry.provenance.sourceKind === 'template' && entry.provenance.templateId === 'rule.not-your-turn')).toBe(true);
  expect(log.entries().some(entry => entry.kind === 'robot-action')).toBe(true);
  vi.useRealTimers();
  const host = createAnalysisHost(); host.start(record, log, solver());
  await waitFor(() => expect(host.snapshot(record).running).toBe(false));
  expect(host.snapshot(record).costs.length).toBeGreaterThan(0);
  render(<ReviewScreen record={record} analysis={host.snapshot(record)} provenanceLog={log} onBack={() => {}} />);
  await waitFor(() => expect(screen.queryByText(text('review.sampling'))).toBeNull());
  const strip = within(document.querySelector('.review-strip') as HTMLElement);
  for (let n = 1; n <= 13; n++) fireEvent.click(strip.getByRole('button', { name: `Trick ${n}` }));
  expect(log.entries().some(entry => entry.summary === 'moment.uncertain')).toBe(true);
  const failed = createAnalysisHost();
  failed.start(record, log, { ...solver(), solvePosition: async () => { throw new Error('failed'); } });
  await waitFor(() => expect(failed.snapshot(record).abstention).toBeTruthy());
  expect(log.entries().some(entry => entry.abstention?.reason === 'unavailable')).toBe(true);
  expectStamped(log.entries());
  cleanup();
  const logs = vi.spyOn(provenance, 'createProvenanceLog');
  vi.useFakeTimers();
  render(<LessonScreen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  for (let n = 0; n < 2; n++) act(() => vi.advanceTimersByTime(500));
  fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
  const authored = logs.mock.results.at(-1)!.value.entries();
  expect(authored).toHaveLength(1);
  expect(authored[0].provenance.sourceKind).toBe('authored');
  expectStamped(authored);
});

test('E-02: review setup, badges and unavailable copy switch without another analysis run', async () => {
  vi.useFakeTimers();
  const play = createPlay({}, undefined, 'northSouth', runner), stop = play.start(); choosePractice(play);
  const record = finishPractice(play); stop(); vi.useRealTimers();
  const locale = controller(); await locale.boot('en');
  const host = createAnalysisHost(), engine = solver();
  host.start(record, play.provenanceLog, engine);
  await waitFor(() => expect(host.snapshot(record).running).toBe(false));
  const analysis = host.snapshot(record), entries = play.provenanceLog.entries();
  const calls = vi.mocked(engine.solvePosition).mock.calls.length;
  function Review() {
    useSyncExternalStore(locale.subscribe, locale.getSnapshot);
    return <ReviewScreen record={record} analysis={analysis} onBack={() => {}} />;
  }
  const mounted = render(<Review />);
  await waitFor(() => expect(screen.queryByText(text('review.sampling'))).toBeNull());
  expect(screen.getByRole('heading', { name: 'Announcements' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Trick 1' }));
  const badges = [...document.querySelectorAll('.review-cost')];
  expect(badges.length).toBeGreaterThan(0);
  expect(badges[0].getAttribute('aria-label')).toContain('X-ray view');
  await act(() => locale.switchTo('es'));
  for (const title of ['Anuncios', 'Declarante y muerto', 'Contrato']) expect(screen.getByRole('button', { name: title })).toBeTruthy();
  for (const badge of badges) expect(badge.getAttribute('aria-label')).toMatch(/^Coste/);
  fireEvent.click(screen.getByRole('button', { name: 'Anuncios' }));
  expect(screen.getByRole('heading', { name: 'Anuncios' })).toBeTruthy();
  expect(engine.solvePosition).toHaveBeenCalledTimes(calls);
  expect(host.snapshot(record)).toBe(analysis);
  expect(play.provenanceLog.entries()).toEqual(entries);
  mounted.unmount();
  const failed = createAnalysisHost();
  failed.start(record, play.provenanceLog, { ...engine, solvePosition: async () => { throw new Error('failed'); } });
  await waitFor(() => expect(failed.snapshot(record).abstention).toBeTruthy());
  const failure = failed.snapshot(record);
  const ui = render(<ReviewScreen record={record} analysis={failure} onBack={() => {}} />);
  expect(screen.getByRole('status').textContent).toBe('No disponible');
  await locale.switchTo('en');
  ui.rerender(<ReviewScreen record={record} analysis={failure} onBack={() => {}} />);
  expect(screen.getByRole('status').textContent).toBe(text('review.unavailable'));
  expect(failure.abstention?.text).toBe('No disponible');
});

test('E-17: moments computed in English display and log fresh cost text when review opens in a new locale', async () => {
  const record = finish(f4Position(points[1]), points[1].candidates[3].cards[0]);
  const log = createPlay().provenanceLog;
  const outcome = { positionIndex: 4, cost: 1, statement: {
    id: 'cost', playthroughId: record.playthroughId, positionIndex: 4, kind: 'statement' as const, summary: 'cost',
    text: text('review.cost-description', { cost: 1, name: 'test', version: '1' }), informationMode: 'ALL_HANDS' as const,
    at: '2026-10-25T00:00:00Z', provenance: { sourceKind: 'engine' as const, name: 'test', version: '1', mode: 'ALL_HANDS' as const, sampleCount: 0 },
  } };
  log.record(outcome.statement);
  const original = log.entries()[0];
  setLocale('es', stub);
  const props = { record, analysis: { running: false, costs: [outcome] }, provenanceLog: log, onBack() {} };
  const ui = render(<ReviewScreen {...props} />);
  await waitFor(() => expect(screen.queryByText(text('review.sampling'))).toBeNull());
  const cost = log.entries().find(entry => entry.summary === 'review.cost-description')!;
  expect(cost).toMatchObject({ locale: 'es', catalogueVersion: catalogueVersion(), text: 'Coste 1 (test, 1). Vista completa.' });
  expect(document.querySelector('.moment-outcome')?.textContent).toBe(cost.text);
  expect(log.entries()[0]).toEqual(original);
  const entries = log.entries();
  setLocale('en', catalogue); ui.rerender(<ReviewScreen {...props} />);
  expect(document.querySelector('.moment-outcome')?.textContent).toBe(outcome.statement.text);
  expect(log.entries()).toEqual(entries);
  expect(currentLocale()).toBe('en');
});
