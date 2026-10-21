import { dealIdOf, RANKS, SEATS, SUITS, sameCard, startPlaythrough, type Card, type Playthrough, type Seat } from '../table';
import type { Content, Exercise, Lesson, Prompt } from '../curriculum/model';

export type Finding = { rule: string; contentId: string; message: string };
type Report = { errors: Finding[]; warnings: Finding[] };
const has = (cards: readonly Card[], card: Card) => cards.some(candidate => sameCard(candidate, card));
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const cardShape = (value: unknown): value is Card => object(value)
  && SUITS.some(suit => suit === value.suit) && RANKS.some(rank => rank === value.rank);
function error(report: Report, rule: string, item: { contentId?: string }, message: string) {
  report.errors.push({ rule, contentId: item.contentId || '(unknown)', message });
}
function rights(item: Content, report: Report) {
  // §4.4, CI-8: presence only; release sign-off gating belongs to MVP.
  if (!object(item.rights) || !nonempty(item.rights.source) || !nonempty(item.rights.licence)
    || !object(item.signOff) || !nonempty(item.signOff.status)) {
    error(report, 'rights-sign-off', item, 'Rights source, licence and sign-off status must be non-empty.');
  }
}
function dealShape(exercise: Exercise, report: Report): boolean {
  const deal = exercise.deal;
  const hands = deal?.hands;
  if (!hands || !SEATS.every(seat => Array.isArray(hands[seat]) && hands[seat].length === 13 && hands[seat].every(cardShape))
    || new Set(SEATS.flatMap(seat => hands[seat].map(card => `${card.suit}:${card.rank}`))).size !== 52) {
    error(report, 'deal-shape', exercise, 'Deal must contain 52 distinct cards, 13 per hand.');
    return false;
  }
  if (!SEATS.includes(deal.dealer) || !deal.vulnerability || deal.dealId !== dealIdOf(deal)) {
    error(report, 'deal-shape', exercise, 'Deal metadata or dealId does not match dealIdOf.');
    return false;
  }
  return true;
}
function miniBridge(lesson: Lesson, exercise: Exercise, report: Report) {
  // US-06.9, US-27.5: lesson Deals must never require a redeal.
  const hcp = (seat: Seat) => exercise.deal.hands[seat].reduce((sum, card) => sum + Math.max(0, 4 - RANKS.indexOf(card.rank)), 0);
  if (lesson.gameFormat === 'minibridge' && hcp('north') + hcp('south') === 20) {
    error(report, 'minibridge-redeal', exercise, 'MiniBridge Deal is 20–20 HCP.');
  }
}
function copyPosition(exercise: Exercise, table: Playthrough) {
  const copy = startPlaythrough(exercise);
  for (const play of table.record().actions) copy.submit(play.seat, play.controller, play.action, play.provenance);
  return copy;
}
function hintReferences(prompt: Prompt, table: Playthrough, exposed: Card[], report: Report) {
  if (!prompt.hint) return;
  // US-15.1–2: prose card-name parsing is out of scope; authors declare structured references.
  const view = table.seatView('south');
  const visible = [...view.hand, ...(view.dummy ?? []), ...exposed,
    ...table.record().actions.map(play => play.action.card)];
  if (!Array.isArray(prompt.hint.referencedCards) || prompt.hint.referencedCards.some(card => !cardShape(card) || !has(visible, card))) {
    error(report, 'hint-references', prompt, 'Hint references must name only visible or earlier exposed cards.');
  }
}
function equivalents(prompt: Prompt, table: Playthrough, seat: Seat, report: Report) {
  const hand = table.seatView(seat).hand;
  const played = table.record().actions.map(play => play.action.card);
  // US-27.3b: same-suit cards in this hand are equivalent when every intervening
  // rank is in this hand or already played: no intervening card remains elsewhere.
  for (const card of hand) {
    if (has(prompt.expectedAnswers, card)) continue;
    const equivalent = prompt.expectedAnswers.some(answer => answer.suit === card.suit
      && RANKS.slice(Math.min(RANKS.indexOf(answer.rank), RANKS.indexOf(card.rank)) + 1,
        Math.max(RANKS.indexOf(answer.rank), RANKS.indexOf(card.rank)))
        .every(rank => has([...hand, ...played], { suit: card.suit, rank })));
    const reviewed = prompt.equivalentsReviewed?.some(review => sameCard(review.card, card)
      && review.decision === 'reject' && nonempty(review.reason));
    const message = `Equivalent ${card.suit} ${card.rank} is not expected or reviewed (rejection needs a reason).`;
    // US-27.3b: multiple reachable lines may expose the same missing equivalent.
    if (equivalent && !reviewed && !report.warnings.some(finding => finding.rule === 'equivalent-cards'
      && finding.contentId === prompt.contentId && finding.message === message)) {
      report.warnings.push({ rule: 'equivalent-cards', contentId: prompt.contentId, message });
    }
  }
}
function expectedAnswers(prompt: Prompt, exercise: Exercise, table: Playthrough, report: Report): Seat | null {
  const seat = table.seatView('south').turn;
  if (!seat || table.controllerOf(seat) !== 'learner' || !Array.isArray(prompt.expectedAnswers) || !prompt.expectedAnswers.length) {
    error(report, 'expected-answer', prompt, 'Prompt needs expected cards at a learner-controlled turn.');
    return null;
  }
  // US-27.3b: the player's accepted cards are exactly expectedAnswers.
  for (const review of prompt.equivalentsReviewed ?? []) {
    if (review.decision === 'accept' && !has(prompt.expectedAnswers, review.card)) {
      error(report, 'equivalent-cards', prompt,
        `Reviewed ${review.card.suit} ${review.card.rank} is accepted but not in expectedAnswers.`);
    }
  }
  for (const card of prompt.expectedAnswers) {
    const result = copyPosition(exercise, table).submit(seat, 'learner', { kind: 'play-card', card });
    if (result.kind === 'rejected') error(report, 'expected-answer', prompt, `Expected answer rejected: ${result.reason}.`);
  }
  if (prompt.acceptThenScripted?.some(card => !cardShape(card) || !has(prompt.expectedAnswers.slice(1), card))) {
    error(report, 'expected-answer', prompt, 'acceptThenScripted must contain accepted alternatives only.');
  }
  return seat;
}
type Position = { prompt: Prompt; table: Playthrough; seat: Seat };
function scriptReplay(exercise: Exercise, report: Report) {
  const table = startPlaythrough(exercise);
  const positions: Position[] = [];
  const exposed: Card[] = [];
  const used = new Set<number>();
  for (const step of exercise.steps) {
    if (step.kind === 'exposure') {
      if (!Array.isArray(step.cards) || step.cards.some(ref => !SEATS.includes(ref.seat) || !cardShape(ref.card)
        || !has(exercise.deal.hands[ref.seat as Seat], ref.card))) {
        error(report, 'hint-references', exercise, 'Exposure must reference a card belonging to its named seat.');
      } else exposed.push(...step.cards.map(ref => ref.card));
    } else if (step.kind === 'scripted-action') {
      // US-27.2: advanceScript requires at least one referenced Robot action.
      if (!Array.isArray(step.scriptIndices) || !step.scriptIndices.length) {
        error(report, 'script-replay', exercise, 'Scripted-action steps require at least one script index.');
        return null;
      }
      for (const index of step.scriptIndices) {
        const play = exercise.script[index];
        if (!Number.isInteger(index) || index < 0 || index >= exercise.script.length || !play || used.has(index)) {
          error(report, 'script-replay', exercise, `Invalid or repeated script index ${index}.`);
          return null;
        }
        used.add(index);
        const result = table.submit(play.seat, 'robot', play.action,
          { kind: 'authored', contentId: exercise.contentId, version: exercise.version });
        if (result.kind === 'rejected') {
          error(report, 'script-replay', exercise, `Script ${index} rejected: ${result.reason}.`);
          return null;
        }
      }
    } else if (step.kind === 'prompt') {
      const prompt = step.prompt;
      hintReferences(prompt, table, exposed, report);
      const before = report.errors.length;
      const seat = expectedAnswers(prompt, exercise, table, report);
      if (!seat || report.errors.length !== before) return null;
      positions.push({ prompt, table: copyPosition(exercise, table), seat });
      table.submit(seat, 'learner', { kind: 'play-card', card: prompt.expectedAnswers[0] });
    }
  }
  if (used.size !== exercise.script.length) {
    error(report, 'script-replay', exercise, 'Every script entry must be referenced exactly once.');
    return null;
  }
  return { table, positions };
}
// US-27.3–3a: bound total answer branches, including canonical and replaced answers.
// Exceeding the budget rejects content; it never silently leaves a line unchecked.
const MAX_ANSWER_BRANCHES = 1024;
function alternatives(exercise: Exercise, canonical: NonNullable<ReturnType<typeof scriptReplay>>, report: Report) {
  const prompts = new Map(canonical.positions.map(position => [position.table.record().actions.length, position.prompt]));
  const winners = canonical.table.seatView('south').tricks.map(trick => trick.winner);
  let lines = [startPlaythrough(exercise)];
  let branches = 0;
  function fail(item: Content, message: string) {
    error(report, 'alternative-continuation', item, message);
  }
  function winnersMatch(table: Playthrough) {
    return table.seatView('south').tricks.every((trick, i) => trick.winner === winners[i]);
  }
  // Canonical records supply fixed seats and authored provenance, not later learner cards.
  // Every Prompt branches again on every reachable position, as the player permits.
  for (const play of canonical.table.record().actions) {
    const prompt = prompts.get(play.index);
    const next: Playthrough[] = [];
    for (const table of lines) {
      if (prompt) {
        // US-27.3b: earlier answers can leave different equivalents in the acting hand.
        equivalents(prompt, table, play.seat, report);
        for (const card of prompt.expectedAnswers) {
          if (++branches > MAX_ANSWER_BRANCHES) {
            fail(prompt, `Exercise exceeds the enumeration limit of ${MAX_ANSWER_BRANCHES} answer branches; validation is incomplete.`);
            return;
          }
          let trial = copyPosition(exercise, table);
          const result = trial.submit(play.seat, 'learner', { kind: 'play-card', card });
          if (result.kind === 'rejected') {
            fail(prompt, `Expected ${card.suit} ${card.rank} is illegal after earlier answers: ${result.reason}.`);
            return;
          }
          if (has(prompt.acceptThenScripted ?? [], card)) {
            // US-27.3a: check the answer first, then replace it exactly as the player does.
            trial = copyPosition(exercise, table);
            const replacement = trial.submit(play.seat, 'learner', play.action);
            if (replacement.kind === 'rejected') {
              fail(prompt, `Canonical replacement is illegal after earlier answers: ${replacement.reason}.`);
              return;
            }
          }
          if (!winnersMatch(trial)) {
            fail(prompt, `Answer ${card.suit} ${card.rank} changes a trick winner; use acceptThenScripted.`);
            return;
          }
          next.push(trial);
        }
      } else {
        const result = table.submit(play.seat, play.controller, play.action, play.provenance);
        if (result.kind === 'rejected' || !winnersMatch(table)) {
          fail(exercise, `Script continuation after accepted answers ${result.kind === 'rejected'
            ? `is illegal: ${result.reason}` : 'changes a trick winner'}; use acceptThenScripted at the earlier Prompt.`);
          return;
        }
        next.push(table);
      }
    }
    lines = next;
  }
}
export function validateLesson(value: unknown): Report {
  const report: Report = { errors: [], warnings: [] };
  if (!object(value) || !Array.isArray(value.exercises) || !value.exercises.length || !['contract-bridge', 'minibridge'].includes(String(value.gameFormat))) {
    error(report, 'lesson-shape', {}, 'Expected a Lesson with gameFormat and at least one exercise.');
    return report;
  }
  const lesson = value as Lesson;
  rights(lesson, report);
  for (const exercise of lesson.exercises) {
    try {
      if (!object(exercise) || !Array.isArray(exercise.steps) || !exercise.steps.length || !Array.isArray(exercise.script)
        || !object(exercise.contract) || !SEATS.includes(exercise.contract.declarer)
        || ![...SUITS, 'no-trumps'].includes(exercise.contract.strain)
        || !Number.isInteger(exercise.contract.level) || exercise.contract.level < 1 || exercise.contract.level > 7
        || exercise.steps.some(step => !object(step) || !['commentary', 'prompt', 'scripted-action', 'exposure'].includes(String(step.kind)))) {
        error(report, 'lesson-shape', exercise ?? {}, 'Exercise requires a valid contract, at least one step and a script.');
        continue;
      }
      rights(exercise, report);
      for (const step of exercise.steps) if (step.kind === 'prompt') rights(step.prompt, report);
      if (!dealShape(exercise, report)) continue;
      miniBridge(lesson, exercise, report);
      if (exercise.contract.declarer === 'north') {
        error(report, 'lesson-shape', exercise, 'North declarers are not supported until #16.');
        continue;
      }
      const canonical = scriptReplay(exercise, report);
      if (canonical) alternatives(exercise, canonical, report);
    } catch (cause) {
      error(report, 'lesson-shape', exercise ?? {}, `Malformed exercise: ${String(cause)}`);
    }
  }
  return report;
}
