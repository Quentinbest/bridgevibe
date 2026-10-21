import { expect, test, vi } from 'vitest';
import { SEATS, dealIdOf, type Card, type Playthrough } from '../table';
import { basicPolicy, fallbackPolicy } from '../robots';
import { catalogue } from '../explanation';
import { createAttemptStore } from '../progress/attemptStore';
import { followSuit, fullFollowSuit, lessonById, loadLesson } from './content';
import { createLessonPlayer } from './lessonPlayer';
import { createPlayer } from './player';

// US-21.6: scripts never consult a robot policy, including after teaching exposures.
vi.mock('../robots', () => ({ basicPolicy: vi.fn(() => { throw new Error('Policy invoked'); }), fallbackPolicy: vi.fn(() => { throw new Error('Policy invoked'); }) }));
const heart: Card = { suit: 'hearts', rank: 'A' };
const wrong: Card = { suit: 'spades', rank: '6' };

test('US-21.7: sequences three Playthroughs, counts only this run, and leaves hint use unpenalized', () => {
  const sink = createAttemptStore();
  for (let run = 0; run < 2; run++) {
    const player = createLessonPlayer(fullFollowSuit, sink, 'learner');
    const ids = new Set<string>();
    let lastStep = 0;
    for (let guard = 0; guard < 40 && !player.snapshot().complete; guard++) {
      const state = player.snapshot();
      ids.add(player.record().playthroughId);
      expect(state.stepIndex).toBeGreaterThanOrEqual(lastStep);
      lastStep = state.stepIndex;
      expect(state.totalExercises).toBe(3);
      expect(state.totalSteps).toBe(16);
      if (state.kind === 'prompt' && !state.outcome) {
        expect(player.next().stepIndex).toBe(state.stepIndex);
        if (state.exerciseIndex > 0) player.answer(wrong, 1);
        player.showHint();
        if (state.exerciseIndex === 2) { player.answer(wrong, 2); player.showAnswer(3); }
        else player.answer(heart, 3);
      } else if (state.kind === 'scripted-action') player.advanceScript();
      else player.next();
    }
    expect(ids.size).toBe(3);
    expect(player.snapshot().summary).toEqual({ rightFirstTime: 1, afterANudge: 1, skillTags: ['follow-suit'] });
    const complete = player.snapshot();
    player.next(); player.answer(heart, 4); player.showAnswer(4); player.advanceScript();
    expect(player.snapshot()).toEqual(complete);
    expect(sink.snapshot()).toHaveLength((run + 1) * 3);
  }
});

test('US-21.6, ADR-0001: exposures preserve every Seat View and the exact record; played cards disappear', () => {
  const exercise = fullFollowSuit.exercises[1];
  let table!: Playthrough;
  let plainTable!: Playthrough;
  const player = createPlayer(exercise, createAttemptStore(), 'learner', inspected => { table = inspected; });
  const plain = createPlayer({ ...exercise, steps: exercise.steps.filter(step => step.kind !== 'exposure') },
    createAttemptStore(), 'learner', inspected => { plainTable = inspected; });
  expect(player).not.toHaveProperty('seatView');
  expect(plain).not.toHaveProperty('seatView');
  const before = player.record();
  const views = SEATS.map(seat => table.seatView(seat));
  player.next();
  expect(player.snapshot().exposed).toEqual([{ seat: 'west', card: { suit: 'hearts', rank: '4' } }]);
  expect(player.record()).toEqual(before);
  expect(SEATS.map(seat => table.seatView(seat))).toEqual(views);
  player.next(); plain.next();
  for (let i = 0; i < 2; i++) { player.advanceScript(); plain.advanceScript(); }
  expect(SEATS.map(seat => table.seatView(seat))).toEqual(SEATS.map(seat => plainTable.seatView(seat)));
  // Independent Playthroughs necessarily have different IDs; every other record field is equal.
  expect(player.record()).toEqual({ ...plain.record(), playthroughId: before.playthroughId });
  expect(player.snapshot().view).toEqual(plain.snapshot().view);
  player.answer(heart, 1); player.next(); player.advanceScript();
  expect(player.snapshot().exposed).toEqual([]);
  expect(basicPolicy).not.toHaveBeenCalled();
  expect(fallbackPolicy).not.toHaveBeenCalled();
});

test('US-21.6: an initial exposure deduplicates cards, filters absent cards, and returns isolated snapshots', () => {
  const exercise = fullFollowSuit.exercises[1];
  const exposure = { seat: 'west' as const, card: { suit: 'hearts' as const, rank: '4' as const } };
  const player = createPlayer({ ...exercise, steps: [{ kind: 'exposure', cards: [exposure, exposure, { seat: 'north', card: heart }] }] }, createAttemptStore(), 'learner');
  const state = player.snapshot();
  expect(state.exposed).toEqual([exposure]);
  // ADR-0001: even an untyped consumer cannot mutate the player's Exposure state.
  (state.exposed as unknown[]).splice(0);
  expect(player.snapshot().exposed).toEqual([exposure]);
});

test('US-21.7, US-27: every authored expected answer completes its whole script through the real Table', () => {
  for (const lesson of [followSuit, fullFollowSuit]) {
    expect(lessonById(lesson.contentId)).toBe(lesson);
    for (const exercise of lesson.exercises) {
      expect(exercise.deal.dealId).toBe(dealIdOf(exercise.deal));
      const prompt = exercise.steps.find(step => step.kind === 'prompt')!;
      for (const answer of prompt.prompt.expectedAnswers) {
        const store = createAttemptStore();
        const player = createPlayer(exercise, store, 'learner');
        for (let guard = 0; guard < 20 && !player.snapshot().complete; guard++) {
          const state = player.snapshot();
          if (state.kind === 'prompt' && !state.outcome) expect(player.answer(answer, 1).outcome).toBe('correct');
          else if (state.kind === 'scripted-action') player.advanceScript();
          else player.next();
        }
        expect(player.snapshot().complete).toBe(true);
        expect(player.record().actions.filter(action => action.controller === 'robot').map(({ seat, action }) => ({ seat, action }))).toEqual(exercise.script);
        expect(store.snapshot()).toHaveLength(1);
      }
    }
  }
  expect(lessonById('unknown')).toBeUndefined();
  expect(new Set(fullFollowSuit.exercises.map(exercise => exercise.deal.dealId)).size).toBe(3);
  expect(() => loadLesson({ ...fullFollowSuit, exercises: [{ ...fullFollowSuit.exercises[0], contract: { level: 1, strain: 'no-trumps', declarer: 'north' } }] })).toThrow(/North/);
});

test('CI-8, FR-C4: all authored items carry rights and draft metadata, and all copy references resolve', () => {
  function check(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if ('signOff' in value) {
      expect(value.signOff).toEqual({ status: 'unsigned-draft' });
      expect(value).toHaveProperty('rights', { source: 'original', licence: 'draft' });
    }
    for (const [key, entry] of Object.entries(value)) {
      if (key.endsWith('Ref') && typeof entry === 'string') expect(catalogue[entry as keyof typeof catalogue]?.status).toBe('draft');
      check(entry);
    }
  }
  check(fullFollowSuit); check(followSuit);
});
