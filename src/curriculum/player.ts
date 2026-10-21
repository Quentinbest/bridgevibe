import { sameCard, startPlaythrough, type Card, type Submission } from '../table';
import type { Attempt, AttemptSink, Exercise, Provenance } from './model';

// US-21: deterministic transitions, no timers, React, or robot policies. The caller supplies time.
export function createPlayer(exercise: Exercise, store: AttemptSink, learnerId: string) {
  const table = startPlaythrough(exercise);
  // US-02, ADR-0003: Script contains only Robot actions; learner actions come from Prompts.
  if (exercise.script.some(play => table.controllerOf(play.seat) !== 'robot')) throw new Error('Script contains a learner-controlled seat');
  let stepIndex = 0;
  let scriptOffset = 0;
  let wrongAnswers = 0;
  let outcome: Attempt['outcome'] | null = null;
  let rejection: Extract<Submission, { kind: 'rejected' }> | null = null;
  let hintTiming: Attempt['hintTiming'] = null;
  let hint: { textRef: string; provenance: Provenance } | null = null;
  const step = () => exercise.steps[stepIndex];
  function enterStep(index: number) {
    stepIndex = index;
    scriptOffset = 0;
    // §4.4, US-28.8: each Prompt starts unresolved with its own answer and hint history.
    if (step().kind === 'prompt') {
      wrongAnswers = 0;
      outcome = null;
      rejection = null;
      hintTiming = null;
      hint = null;
    }
  }
  function snapshot() {
    const current = step();
    // ADR-0001: never return the Exercise, Script or full Deal to the screen.
    return { stepIndex, totalSteps: exercise.steps.length, kind: current.kind,
      textRef: current.kind === 'commentary' ? current.textRef : null,
      prompt: current.kind === 'prompt' ? current.prompt : null,
      view: table.seatView('south'), wrongAnswers, outcome, rejection, hint };
  }
  function finish(result: Attempt['outcome'], time: number) {
    const current = step();
    if (current.kind !== 'prompt') return;
    outcome = result;
    store.append({ learnerId, promptContentId: current.prompt.contentId, version: current.prompt.version,
      outcome: result, hintTier: hint ? 'a' : 'none', hintTiming, time, playthroughId: table.record().playthroughId });
  }
  // US-02.2: when the learner's side declares, the learner also plays Dummy, so answer for the seat on turn.
  function learnerSeat() {
    const turn = table.seatView('south').turn;
    return turn && table.controllerOf(turn) === 'learner' ? turn : null;
  }
  function answer(card: Card, time: number) {
    const current = step();
    const seat = learnerSeat();
    if (current.kind !== 'prompt' || outcome || wrongAnswers >= 2 || !seat) return snapshot();
    // INV-1: probe the real Table on a replay, so a legal but unexpected answer cannot derail the Script.
    const trial = startPlaythrough(exercise);
    for (const played of table.record().actions) trial.submit(played.seat, played.controller, played.action, played.provenance);
    const result = trial.submit(seat, 'learner', { kind: 'play-card', card });
    rejection = result.kind === 'rejected' ? result : null;
    if (result.kind === 'rejected' && !current.prompt.countsRejections) return snapshot();
    if (result.kind === 'accepted' && current.prompt.expectedAnswers.some(expected => sameCard(expected, card))) {
      // US-27.3a: accept the alternative while preserving the author's continuation.
      const played = current.prompt.acceptThenScripted?.some(expected => sameCard(expected, card))
        ? current.prompt.expectedAnswers[0] : card;
      table.submit(seat, 'learner', { kind: 'play-card', card: played });
      finish(wrongAnswers ? 'corrected' : 'correct', time);
    } else wrongAnswers++;
    return snapshot();
  }
  function showAnswer(time: number) {
    const current = step();
    const seat = learnerSeat();
    if (current.kind !== 'prompt' || outcome || wrongAnswers < 2 || !seat) return snapshot();
    const result = table.submit(seat, 'learner', { kind: 'play-card', card: current.prompt.expectedAnswers[0] });
    if (result.kind === 'rejected') throw new Error('Authored answer rejected by Table');
    rejection = null;
    finish('failed', time);
    return snapshot();
  }
  function next() {
    const current = step();
    if (current.kind === 'scripted-action' || (current.kind === 'prompt' && !outcome)) return snapshot();
    if (stepIndex < exercise.steps.length - 1) enterStep(stepIndex + 1);
    return snapshot();
  }
  function advanceScript() {
    const current = step();
    if (current.kind !== 'scripted-action') return snapshot();
    const scripted = exercise.script[current.scriptIndices[scriptOffset]];
    const result = table.submit(scripted.seat, table.controllerOf(scripted.seat), scripted.action, {
      kind: 'authored', contentId: exercise.contentId, version: exercise.version });
    if (result.kind === 'rejected') throw new Error('Authored script rejected by Table');
    if (++scriptOffset === current.scriptIndices.length) enterStep(stepIndex + 1);
    return snapshot();
  }
  function showHint() {
    const current = step();
    if (current.kind === 'prompt' && current.prompt.hint && !outcome && !hint) {
      hintTiming = wrongAnswers ? 'after-wrong-answer' : 'before-first-answer';
      // US-14.4: expose authored provenance; #9 wires this to the coach log after both tickets land.
      hint = { textRef: current.prompt.hint.textRef, provenance: {
        sourceKind: 'authored', contentId: current.prompt.contentId, version: current.prompt.version } };
    }
    return snapshot();
  }
  return { record: table.record, snapshot, answer, showAnswer, next, advanceScript, showHint };
}
