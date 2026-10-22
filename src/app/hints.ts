import { HINT_DEADLINE_MS } from '../information/parameters';
import { configuredEngine } from '../analysis/solverSelection';
import type { HintResult } from '../analysis/sampledEstimate';
import { hintStatement } from '../coach/hint';
import { cardName, text } from '../explanation';
import { RANKS, sideOf, type Card, type SeatView } from '../table';
import { runHint, type HintRunner } from './hintClient';

// US-14.3: Dummy's controller reasons from Declarer's view in both declaring orientations.
export const hintSeat = (declarer: SeatView['seat']) => sideOf(declarer) === 'northSouth' ? declarer : 'south';
export function renderHint(result: HintResult) {
  const templateId = 'abstention' in result ? `hint.${result.abstention.reason}` as const : 'hint.advice';
  const card: Card | undefined = 'classes' in result ? result.classes[0]?.cards.reduce((a, b) => RANKS.indexOf(a.rank) > RANKS.indexOf(b.rank) ? a : b) : undefined;
  const advice = text(templateId, card ? { card: cardName(card) } : {});
  const reason = 'abstention' in result ? '' : text('hint.reason');
  return { templateId, advice, reason, text: [text('hint.label'), advice, reason, text('hint.choose')].filter(Boolean).join('\n') };
}
export type HintSnapshot = { enabled: boolean; open: boolean; thinking: boolean; abstained: boolean; advice: string; reason: string; durationMs: number | null; exceededTarget: boolean };
export function createHints(changed: () => void, log: (entry: ReturnType<typeof hintStatement>, positionIndex: number) => void, runner: HintRunner = runHint) {
  let state: HintSnapshot = { enabled: true, open: false, thinking: false, abstained: false, advice: '', reason: '', durationMs: null, exceededTarget: false };
  const timings: { durationMs: number; exceededTarget: boolean }[] = [];
  let cancel: (() => void) | undefined;
  let key: string | undefined;
  let generation = 0;
  let statement: ReturnType<typeof hintStatement> | undefined;
  let position = 0;
  let logged = false;
  function record() { if (state.open && statement && !logged) { log(statement, position); logged = true; } }
  return {
    snapshot: () => state,
    timings: () => timings.map(timing => ({ ...timing })),
    sync(view: SeatView | null, candidates: readonly Card[]) {
      const next = state.enabled && view && candidates.length ? `${view.seat}:${view.positionIndex}` : undefined;
      if (next === key) return;
      cancel?.(); generation++; key = next; statement = undefined; logged = false;
      state = { ...state, open: false, thinking: !!next, abstained: false, advice: '', reason: '' };
      if (!next || !view) return;
      position = view.positionIndex;
      const owned = generation;
      cancel = runner(view, candidates, (result, durationMs) => {
        if (owned !== generation) return;
        timings.push({ durationMs, exceededTarget: durationMs > HINT_DEADLINE_MS });
        const rendered = renderHint(result);
        state = { ...state, thinking: false, abstained: 'abstention' in result, advice: rendered.advice, reason: rendered.reason, durationMs, exceededTarget: durationMs > HINT_DEADLINE_MS };
        statement = hintStatement(result, configuredEngine(), durationMs, rendered);
        record(); changed();
      });
    },
    toggle() { state = { ...state, enabled: !state.enabled, open: false }; changed(); },
    show() { if (!state.enabled || !key) return; state = { ...state, open: true }; record(); changed(); },
    dismiss() { state = { ...state, open: false }; changed(); },
    stop() { cancel?.(); generation++; key = undefined; },
  };
}
