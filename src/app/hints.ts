import { HINT_DEADLINE_MS } from '../information/parameters';
import { configuredEngine } from '../analysis/solverSelection';
import { visibleClasses, type HintResult } from '../analysis/sampledEstimate';
import { hintStatement } from '../coach/hint';
import { text } from '../explanation';
import { renderCopy, type Copy } from './copy';
import { RANKS, sideOf, seatViewSeed, type Card, type SeatView } from '../table';
import type { HintIdentity } from './hintProtocol';
import { runHint, type HintRunner } from './hintClient';
import type { LogEntry } from '../coach/provenance';

export type AuthoredSetupHint = { textRef: Parameters<typeof text>[0]; contentId: string; version: string };
type Statement = Pick<LogEntry, 'kind' | 'summary' | 'text' | 'provenance' | 'abstention'>;

// US-14.3: Dummy's controller reasons from Declarer's view in both declaring orientations.
export const hintSeat = (declarer: SeatView['seat']) => sideOf(declarer) === 'northSouth' ? declarer : 'south';
function hintCopy(result: HintResult) {
  const templateId = 'abstention' in result
    ? result.abstention.reason === 'unavailable'
      ? result.abstention.cause === 'timeout' ? 'hint.unavailable-timeout' : 'hint.unavailable-failure'
      : 'hint.uncertain'
    : 'hint.advice';
  const card: Card | undefined = 'classes' in result ? result.classes[0]?.cards.reduce((a, b) => RANKS.indexOf(a.rank) > RANKS.indexOf(b.rank) ? a : b) : undefined;
  const advice: Copy = { id: templateId, params: card ? { card } : {} };
  const reason: Copy | null = 'abstention' in result ? null : { id: 'hint.reason', params: {} };
  return { templateId, advice, reason };
}
export function renderHint(result: HintResult) {
  const copy = hintCopy(result);
  const templateId = copy.templateId, advice = renderCopy(copy.advice), reason = copy.reason ? renderCopy(copy.reason) : '';
  return { templateId, advice, reason, text: [text('hint.label'), advice, reason, text('hint.choose')].filter(Boolean).join('\n') };
}
export type HintSnapshot = { enabled: boolean; open: boolean; thinking: boolean; abstained: boolean; advice: Copy | null; reason: Copy | null; durationMs: number | null; exceededTarget: boolean; advisedClass?: readonly Card[]; positionIndex?: number };
export function createHints(changed: () => void, log: (entry: Statement, positionIndex: number) => void, runner: HintRunner = runHint) {
  let state: HintSnapshot = { enabled: true, open: false, thinking: false, abstained: false, advice: null, reason: null, durationMs: null, exceededTarget: false };
  const timings: { durationMs: number; exceededTarget: boolean }[] = [];
  let cancel: (() => void) | undefined;
  let key: string | undefined;
  let generation = 0;
  let statement: (() => Statement) | undefined;
  // US-45.1, US-14.12: omit fault code from production and cancel even while it loads.
  if (import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'internal' || import.meta.env.MODE === 'development') {
    const baseRunner = runner;
    runner = (view, candidates, done, identity) => {
      let cancelled = false;
      let stop: (() => void) | undefined;
      void import('./hintFaults').then(({ auditHintRunner }) => {
        if (!cancelled) stop = auditHintRunner(baseRunner)(view, candidates, done, identity);
      }, () => {
        if (!cancelled) done({ abstention: { reason: 'unavailable', cause: 'error' }, sampleCount: 0, enumerated: false }, 0);
      });
      return () => { cancelled = true; stop?.(); };
    };
  }
  let position = 0;
  let logged = false;
  function record() { if (state.open && statement && !logged) { log(statement(), position); logged = true; } }
  return {
    snapshot: () => state,
    timings: () => timings.map(timing => ({ ...timing })),
    // US-14.11: Setup has authored coverage only; never send it to tier (c).
    syncSetup(positionKey: string | undefined, authored?: AuthoredSetupHint) {
      const next = state.enabled && positionKey ? `setup:${positionKey}` : undefined;
      if (next === key) return;
      cancel?.(); cancel = undefined; generation++; key = next; logged = false; statement = undefined; position = 0;
      state = { ...state, open: false, thinking: false, abstained: !authored, advice: null, reason: null, durationMs: null, exceededTarget: false, advisedClass: undefined, positionIndex: undefined };
      if (!next) return;
      const templateId = authored?.textRef ?? 'hint.not-covered';
      state.advice = { id: templateId, params: {} };
      statement = () => ({ kind: 'statement', summary: templateId, text: text(templateId),
        ...(authored ? {} : { abstention: { reason: 'not-covered', cause: 'no-authored-hint' } as const }),
        provenance: authored ? { sourceKind: 'authored', contentId: authored.contentId, version: authored.version } : { sourceKind: 'template', templateId } });
    },
    sync(view: SeatView | null, candidates: readonly Card[], identity: HintIdentity | null) {
      const next = state.enabled && view && identity && candidates.length ? `${identity.playthroughId}:${identity.positionKey}:${view.seat}` : undefined;
      if (next === key) return;
      cancel?.(); cancel = undefined; generation++; key = next; statement = undefined; logged = false;
      state = { ...state, open: false, thinking: !!next, abstained: false, advice: null, reason: null, durationMs: null, exceededTarget: false, advisedClass: undefined, positionIndex: view?.positionIndex };
      if (!next || !view || !identity) return;
      position = view.positionIndex;
      // US-14.11: visible equivalence proves a forced play without sampling.
      if (visibleClasses(view, candidates).length === 1) {
        const templateId = candidates.length === 1 ? 'hint.forced-card' : 'hint.forced-class';
        const advice: Copy = { id: templateId, params: { card: candidates[0], cards: candidates } };
        state = { ...state, thinking: false, advice };
        statement = () => ({ kind: 'statement', summary: templateId, text: renderCopy(advice), provenance: { sourceKind: 'template', templateId } });
        return;
      }
      const owned = generation;
      // ADR-0001: the full Table key stays in `key`; only the visible digest crosses the boundary.
      cancel = runner(view, candidates, (result, durationMs, source) => {
        if (owned !== generation) return;
        timings.push({ durationMs, exceededTarget: durationMs > HINT_DEADLINE_MS });
        const rendered = hintCopy(result);
        state = { ...state, thinking: false, abstained: 'abstention' in result, advice: rendered.advice, reason: rendered.reason, durationMs, exceededTarget: durationMs > HINT_DEADLINE_MS,
          advisedClass: 'classes' in result ? result.classes[0].cards : undefined };
        // CI-5: attribute worker results to the worker's reported engine and sampler.
        // E-17: defer rendering until the sheet records the statement.
        const engine = source?.engine ?? configuredEngine();
        statement = () => hintStatement(result, engine, durationMs, renderHint(result), source?.sampler);
        record(); changed();
      }, { playthroughId: identity.playthroughId, positionKey: seatViewSeed(view) });
    },
    toggle() { state = { ...state, enabled: !state.enabled, open: false }; changed(); },
    show() { if (!state.enabled || !key) return; state = { ...state, open: true }; record(); changed(); },
    dismiss() { state = { ...state, open: false }; changed(); },
    stop() { cancel?.(); generation++; key = undefined; },
  };
}
