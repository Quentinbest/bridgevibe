import { afterEach, expect, test, vi } from 'vitest';
import { encodeSeatView, startPlaythrough, sameCard, seatViewSeed, type Deal, type SeatView, type Card } from '../table';
import { visibleClasses, sampledEstimate } from '../analysis/sampledEstimate';
import type { SolverPort } from '../analysis';
import { runHint, type HintRunner, type HintWorker } from './hintClient';
import { createPlay } from './play';
import { fixedDeal } from './fixture';
import { choosePractice } from '../../test/miniBridge';
import { createHints, hintSeat, renderHint } from './hints';
import { cardName, catalogue, text } from '../explanation';
import { hintStatement } from '../coach/hint';
import { faultHintRunner, type HintFault } from './hintFaults';
import { completeFixedDeal } from '../../test/strategy';
import { validateEntry } from '../coach/provenance';
const engine = { name: 'test', version: '1' };
const solver: SolverPort = { ...engine, solveTable: vi.fn(), solvePosition: async layout => ({ ...engine, classes: Object.values(layout).flat().map(card => ({ cards: [card], tricks: 3 })) }) };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function begin(deal = fixedDeal, runner?: HintRunner) {
  const play = createPlay({}, deal, 'northSouth', runner); const stop = play.start(); choosePractice(play); vi.advanceTimersByTime(500); return { play, stop };
}
test('speculates without showing, request shows thinking, action cancels and stale replies are discarded', () => {
  vi.useFakeTimers();
  const cancelled = vi.fn(); let complete: Parameters<HintRunner>[2] | undefined;
  const { play, stop } = begin(fixedDeal, (_view, _cards, done) => { complete = done; return cancelled; });
  expect(play.getSnapshot().hint).toMatchObject({ open: false, thinking: true });
  play.showHint(); expect(play.getSnapshot().hint).toMatchObject({ open: true, thinking: true });
  play.play('north', play.getSnapshot().legalCards[0]);
  expect(cancelled).toHaveBeenCalledOnce();
  complete!({ abstention: { reason: 'unavailable', cause: 'timeout' }, sampleCount: 0, enumerated: false }, 3001);
  expect(play.getSnapshot().hint?.open).toBe(false);
  expect(play.provenanceLog.entries().filter(e => e.summary.startsWith('hint.'))).toHaveLength(0);
  stop();
});
test('toggle cancels and hides hints; complete output is logged once only when requested with latency and full provenance', () => {
  vi.useFakeTimers();
  const { play, stop } = begin(fixedDeal, (_view, _cards, done) => { done({ abstention: { reason: 'uncertain', cause: 'constraints' }, sampleCount: 0, enumerated: false }, 120); return vi.fn(); });
  expect(play.provenanceLog.entries().filter(e => e.abstention)).toHaveLength(0);
  expect(play.hintTimings()).toEqual([{ durationMs: 120, exceededTarget: false }]);
  play.showHint(); play.dismissHint(); play.showHint();
  const entries = play.provenanceLog.entries().filter(e => e.abstention);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ informationMode: 'VISIBLE', abstention: { reason: 'uncertain', cause: 'constraints' }, provenance: { hint: { sampler: 'bv-layout', samplerVersion: '1', durationMs: 120, exceededTarget: false, templateId: 'hint.uncertain', enumerated: false } } });
  expect(validateEntry(entries[0])).toEqual([]);
  play.toggleHints(); play.showHint(); expect(play.getSnapshot().hint).toMatchObject({ enabled: false, open: false }); stop();
});
test.each(['north', 'south', 'east'] as const)('composition uses the correct Seat View when %s declares, including Dummy candidates', declarer => {
  vi.useFakeTimers();
  // US-14.3: rotate the authored hands so each requested seat holds the declaring high points.
  const source = ['north','east','south','west'] as const;
  const offset = (source.indexOf(declarer) - source.indexOf('south') + 4) % 4;
  const deal: Deal = { ...fixedDeal, hands: Object.fromEntries(source.map((seat, i) => [source[(i + offset) % 4], fixedDeal.hands[seat]])) as Deal['hands'] };
  const seen: { view: SeatView; cards: readonly Card[] }[] = [];
  const play = createPlay({}, deal, 'northSouth', (view, cards) => { seen.push({ view, cards }); return vi.fn(); });
  const stop = play.start(); vi.advanceTimersByTime(3000);
  if (declarer !== 'east') play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' });
  for (let i = 0; i < 40; i++) {
    const view = play.getSnapshot();
    if (!view.collecting && view.legalCards.length && (view.turn === 'north' || view.turn === 'south')) play.play(view.turn, view.legalCards[0]);
    vi.advanceTimersByTime(500);
  }
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every(e => e.view.seat === (declarer === 'east' ? 'south' : declarer))).toBe(true);
  if (declarer !== 'east') expect(seen.some(e => e.view.turn !== e.view.seat)).toBe(true);
  for (const { view, cards } of seen) expect(cards.every(card => (view.turn === view.seat ? view.hand : view.dummy)!.some(c => sameCard(c, card)))).toBe(true);
  stop();
});
test('F3 composition: changing only hidden spot cards with the same public history yields identical computed advice', async () => {
  vi.useFakeTimers();
  const alternate = structuredClone(fixedDeal);
  const east = alternate.hands.east.findIndex(c => c.suit === 'diamonds' && c.rank === '6');
  const west = alternate.hands.west.findIndex(c => c.suit === 'diamonds' && c.rank === '8');
  const hands = { ...alternate.hands, east: [...alternate.hands.east], west: [...alternate.hands.west] };
  [hands.east[east], hands.west[west]] = [hands.west[west], hands.east[east]];
  const results: Promise<ReturnType<typeof renderHint>>[] = [];
  const views: unknown[] = [];
  const runner: HintRunner = (view, cards) => {
    views.push(encodeSeatView(view));
    results.push(sampledEstimate(solver, view, cards, 50, seatViewSeed(view), Infinity).then(renderHint));
    return vi.fn();
  };
  const a = begin(fixedDeal, runner); const b = begin({ ...alternate, hands: hands as unknown as Deal['hands'] }, runner);
  expect(views).toHaveLength(2); expect(views[0]).toEqual(views[1]);
  const advice = await Promise.all(results); expect(advice[0]).toEqual(advice[1]); expect(advice[0].templateId).toBe('hint.advice');
  a.stop(); b.stop();
});
test('every hint template and rendered output avoids percentages, probabilities and decimals', () => {
  for (const id of Object.keys(catalogue).filter(id => id.startsWith('hint.')) as (keyof typeof catalogue)[]) {
    expect(catalogue[id].status).toBe('draft');
    for (const copy of [catalogue[id].text, text(id, { card: 'King of spades' })]) expect(copy).not.toMatch(/%|percent|probab|\d+\.\d+/i);
  }
  const base = { ...hintStatement({ classes: [{ cards: [{ suit: 'spades', rank: 'K' }], tricks: 3.75 }], sampleCount: 50, enumerated: false }, engine, 20, { text: text('hint.advice', { card: 'King of spades' }), templateId: 'hint.advice' }),
    id: 'hint', playthroughId: 'test', positionIndex: 0, informationMode: 'VISIBLE', at: new Date().toISOString() };
  expect(validateEntry(base)).toEqual([]);
  const missingHint = structuredClone(base); if (missingHint.provenance.sourceKind === 'engine') delete missingHint.provenance.hint;
  expect(validateEntry(missingHint)).toContain('provenance.hint');
  for (const key of ['sampler', 'samplerVersion', 'enumerated', 'templateId', 'durationMs', 'exceededTarget']) {
    const entry = structuredClone(base); if (entry.provenance.sourceKind !== 'engine') throw new Error('expected engine');
    Reflect.deleteProperty(entry.provenance.hint!, key); expect(validateEntry(entry)).toContain('provenance.hint');
  }
});
test('a shown unavailable abstention logs its timeout cause and a missed U-01 target', () => {
  vi.useFakeTimers();
  const { play, stop } = begin(fixedDeal, (_view, _cards, done) => { done({ abstention: { reason: 'unavailable', cause: 'timeout' }, sampleCount: 0, enumerated: false }, 3001); return vi.fn(); });
  play.showHint();
  expect(play.getSnapshot().hint?.advice).toBe(text('hint.unavailable-timeout'));
  expect(play.provenanceLog.entries().find(e => e.abstention)).toMatchObject({ abstention: { reason: 'unavailable', cause: 'timeout' }, provenance: { hint: { durationMs: 3001, exceededTarget: true } } });
  expect(play.hintTimings()).toEqual([{ durationMs: 3001, exceededTarget: true }]); stop();
});

test.each(['worker-crash', 'protocol-mismatch'] as const)('US-45.1: %s survives the worker client through the logged statement', cause => {
  vi.useFakeTimers();
  const workers: HintWorker[] = [];
  const runner: HintRunner = (view, cards, done, identity) => runHint(view, cards, done, identity, () => {
    const owned: HintWorker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
    workers.push(owned); return owned;
  });
  const { play, stop } = begin(fixedDeal, runner); play.showHint();
  if (cause === 'worker-crash') workers[0].onerror!({} as ErrorEvent);
  else {
    workers[0].onmessage!({ data: { type: 'hello', protocolVersion: 99 } } as MessageEvent);
    expect(play.provenanceLog.entries().some(e => e.abstention)).toBe(false);
    workers[1].onmessage!({ data: { type: 'hello', protocolVersion: 99 } } as MessageEvent);
  }
  const entry = play.provenanceLog.entries().find(e => e.abstention)!;
  expect(entry).toMatchObject({ informationMode: 'VISIBLE', abstention: { reason: 'unavailable', cause }, summary: 'hint.unavailable-failure' });
  expect(validateEntry(entry)).toEqual([]); stop();
});

test.each(['act', 'disable'] as const)('a hidden hint does not resume when the learner chooses to %s', action => {
  vi.useFakeTimers();
  const visibility = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('document', visibility);
  const workers: HintWorker[] = [];
  const runner: HintRunner = (view, cards, done, identity) => runHint(view, cards, done, identity, () => {
    const owned: HintWorker = { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
    workers.push(owned); return owned;
  });
  const { play, stop } = begin(fixedDeal, runner);
  play.showHint(); expect(workers).toHaveLength(1);
  visibility.visibilityState = 'hidden'; visibility.dispatchEvent(new Event('visibilitychange'));
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  if (action === 'act') play.play('north', play.getSnapshot().legalCards[0]); else play.toggleHints();
  vi.advanceTimersByTime(10000);
  visibility.visibilityState = 'visible'; visibility.dispatchEvent(new Event('visibilitychange'));
  expect(workers).toHaveLength(1);
  expect(play.provenanceLog.entries().some(e => e.abstention)).toBe(false); stop();
});
test('CI-5, §4.3.6: provenance names the engine and sampler the worker reported, not the page bundle', () => {
  vi.useFakeTimers();
  const source = { engine: { name: 'older-engine', version: '0.9' }, sampler: { name: 'bv-layout', version: '0' } };
  const { play, stop } = begin(fixedDeal, (_view, _cards, done) => { done({ abstention: { reason: 'uncertain', cause: 'constraints' }, sampleCount: 0, enumerated: false }, 80, source); return vi.fn(); });
  play.showHint();
  const [entry] = play.provenanceLog.entries().filter(e => e.abstention);
  expect(entry.provenance).toMatchObject({ name: 'older-engine', version: '0.9', hint: { sampler: 'bv-layout', samplerVersion: '0' } });
  expect(validateEntry(entry)).toEqual([]);
  stop();
});

test('US-14.11: forced cards bypass the runner throughout a Playthrough and log VISIBLE templates', () => {
  vi.useFakeTimers();
  const calls: number[] = [];
  const { play, stop } = begin(fixedDeal, (view) => { calls.push(view.positionIndex); return vi.fn(); });
  const forced = new Set<string>();
  for (const entry of completeFixedDeal().actions) {
    if (entry.controller === 'robot') vi.advanceTimersByTime(500);
    else {
      const snapshot = play.getSnapshot();
      const view = play.seatView(hintSeat(play.record().contract.declarer));
      if (!('contract' in view)) throw new Error('expected card play');
      if (visibleClasses(view, snapshot.legalCards).length === 1) {
        const templateId = snapshot.legalCards.length === 1 ? 'hint.forced-card' : 'hint.forced-class';
        forced.add(templateId);
        expect(calls).not.toContain(view.positionIndex);
        play.showHint();
        expect(play.getSnapshot().hint).toMatchObject({ thinking: false, abstained: false,
          advice: text(templateId, { card: cardName(snapshot.legalCards[0]), cards: snapshot.legalCards.map(cardName).join(', ') }) });
        const logged = play.provenanceLog.entries().at(-1)!;
        expect(logged).toMatchObject({ informationMode: 'VISIBLE', provenance: { sourceKind: 'template', templateId } });
        expect(validateEntry(logged)).toEqual([]);
      }
      play.play(entry.seat as 'north' | 'south', entry.action.card);
    }
    if (entry.index % 4 === 3) vi.advanceTimersByTime(1000);
  }
  expect([...forced]).toEqual(['hint.forced-card']);
  stop();
});

test.each([false, true])('US-14.11: contract choice uses authored lookup (%s), never sampling', authored => {
  vi.useFakeTimers();
  const runner = vi.fn<HintRunner>(() => vi.fn());
  const lookup = vi.fn(() => authored ? { textRef: 'lesson.hint-text' as const, contentId: 'setup-test', version: '1' } : undefined);
  const play = createPlay({}, fixedDeal, 'northSouth', runner, lookup);
  const stop = play.start(); vi.advanceTimersByTime(3000);
  play.showHint();
  expect(runner).not.toHaveBeenCalled(); expect(lookup).toHaveBeenCalled();
  expect(play.getSnapshot().hint).toMatchObject({ open: true, thinking: false, abstained: !authored,
    advice: text(authored ? 'lesson.hint-text' : 'hint.not-covered') });
  const entry = play.provenanceLog.entries().at(-1)!;
  expect(entry).toMatchObject({ informationMode: 'VISIBLE', provenance: { sourceKind: authored ? 'authored' : 'template' } });
  if (!authored) expect(entry.abstention).toEqual({ reason: 'not-covered', cause: 'no-authored-hint' });
  expect(validateEntry(entry)).toEqual([]);
  play.toggleHints(); play.showHint(); expect(play.getSnapshot().hint?.open).toBe(false);
  stop();
});

test.each<HintFault>(['timeout', 'no-layout', 'low-confidence', 'error', 'worker-crash', 'protocol-mismatch'])('US-45.1: injected %s shows and logs the matching abstention without fallback', async fault => {
  vi.useFakeTimers();
  const { play, stop } = begin(fixedDeal, faultHintRunner(fault));
  play.showHint(); await vi.advanceTimersByTimeAsync(3001);
  const reason = fault === 'no-layout' || fault === 'low-confidence' ? 'uncertain' : 'unavailable';
  const cause = reason === 'uncertain' ? 'constraints' : fault;
  const templateId = reason === 'uncertain' ? 'hint.uncertain'
    : fault === 'timeout' ? 'hint.unavailable-timeout' : 'hint.unavailable-failure';
  const snapshot = play.getSnapshot().hint!;
  expect(snapshot).toMatchObject({ open: true, thinking: false, abstained: true });
  expect(snapshot.advice).toBe(text(templateId));
  expect(snapshot.advice).not.toMatch(/samples|rule of thumb|best card/i);
  const entries = play.provenanceLog.entries().filter(entry => entry.abstention);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ summary: templateId, abstention: { reason, cause }, provenance: { hint: { templateId } } });
  expect(validateEntry(entries[0])).toEqual([]);
  expect(play.provenanceLog.counters().silentFallbacks).toBe(0);
  stop();
});

test('US-14.11: setup lookup state is discarded on entering card play', () => {
  const entries: unknown[] = [];
  const hints = createHints(vi.fn(), entry => entries.push(entry), vi.fn(() => vi.fn()));
  hints.syncSetup('choice'); hints.show();
  hints.sync(null, [], null); hints.show();
  expect(hints.snapshot().open).toBe(false);
  expect(entries).toHaveLength(1);
});


test('US-14.11: a real Table with an entire legal suit in one visible class starts no worker', () => {
  const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
  const seats = ['north', 'east', 'south', 'west'] as const;
  const all = Object.values(fixedDeal.hands).flat();
  const hands = Object.fromEntries(seats.map((seat, i) => [seat, all.filter(card => card.suit === suits[i])])) as unknown as Deal['hands'];
  const table = startPlaythrough({ deal: { ...fixedDeal, hands }, contract: { level: 1, strain: 'no-trumps', declarer: 'east' }, learnerSide: 'northSouth' });
  const view = table.seatView('south');
  const cards = table.legalActions('south').map(action => action.card);
  const runner = vi.fn<HintRunner>(() => vi.fn()); const log = vi.fn();
  const hints = createHints(vi.fn(), log, runner);
  hints.sync(view, cards, { playthroughId: table.record().playthroughId, positionKey: table.positionKey() }); hints.show();
  expect(cards).toHaveLength(13); expect(runner).not.toHaveBeenCalled();
  expect(hints.snapshot()).toMatchObject({ open: true, thinking: false, abstained: false,
    advice: text('hint.forced-class', { cards: cards.map(cardName).join(', ') }) });
  expect(log).toHaveBeenCalledWith(expect.objectContaining({ summary: 'hint.forced-class', provenance: { sourceKind: 'template', templateId: 'hint.forced-class' } }), 0);
  const entry = { ...log.mock.calls[0][0], id: 'equivalent', playthroughId: table.record().playthroughId, positionIndex: 0, informationMode: 'VISIBLE', at: new Date().toISOString() };
  expect(validateEntry(entry)).toEqual([]);
});

test.each([false, true])('US-14.12: deferred fault wrapper respects cancellation before import (cancelled: %s)', async cancelled => {
  vi.stubEnv('MODE', 'internal');
  try {
    const table = startPlaythrough({ deal: fixedDeal, contract: { level: 1, strain: 'no-trumps', declarer: 'east' }, learnerSide: 'northSouth' });
    const runner = vi.fn<HintRunner>(() => vi.fn());
    const hints = createHints(vi.fn(), vi.fn(), runner);
    hints.sync(table.seatView('south'), table.legalActions('south').map(action => action.card), { playthroughId: table.record().playthroughId, positionKey: table.positionKey() });
    expect(runner).not.toHaveBeenCalled();
    if (cancelled) hints.sync(null, [], null);
    await vi.dynamicImportSettled();
    expect(runner).toHaveBeenCalledTimes(cancelled ? 0 : 1);
    hints.stop();
  } finally { vi.unstubAllEnvs(); }
});

test('§4.3.6: composition supplies the Playthrough ID and a Table digest for each hint position', () => {
  vi.useFakeTimers();
  const runner = vi.fn<HintRunner>(() => vi.fn());
  const { play, stop } = begin(fixedDeal, runner);
  const [, , , identity] = runner.mock.calls[0];
  expect(identity.playthroughId).toBe(play.record().playthroughId);
  expect(identity.positionKey).toMatch(/^[0-9a-f]{16}$/);
  stop();
});

test('US-14.3: the setup hint lookup receives the declaring learner\'s own view when North declares', () => {
  vi.useFakeTimers();
  // Rotate the authored hands so North holds South's (declaring) cards.
  const source = ['north', 'east', 'south', 'west'] as const;
  const deal: Deal = { ...fixedDeal, hands: Object.fromEntries(source.map((seat, i) => [source[(i + 2) % 4], fixedDeal.hands[seat]])) as Deal['hands'] };
  const lookup = vi.fn(() => undefined);
  const play = createPlay({}, deal, 'northSouth', vi.fn<HintRunner>(() => vi.fn()), lookup);
  const stop = play.start(); vi.advanceTimersByTime(3000);
  expect(lookup).toHaveBeenCalled();
  for (const [view] of lookup.mock.calls as unknown as [{ seat: string; declarer: string }][]) {
    expect(view.declarer).toBe('north'); expect(view.seat).toBe('north');
  }
  stop();
});
