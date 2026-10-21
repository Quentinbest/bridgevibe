import { describe, expect, test, vi } from 'vitest';
import { dealIdOf, exportRecordJson, importRecordJson, sameCard, startPlaythrough, type Card } from '../table';
import { catalogue } from '../explanation';
import { followSuit, loadLesson } from './content';
import { createAttemptStore } from '../progress/attemptStore';
import { createPlayer } from './player';
import type { Exercise, Prompt, ScriptAction } from './model';

// US-21.1: a policy that throws proves the lesson path never asks a robot to decide.
vi.mock('../robots', () => ({ basicPolicy: vi.fn(() => { throw new Error('Policy invoked'); }), fallbackPolicy: vi.fn(() => { throw new Error('Policy invoked'); }) }));
const exercise = followSuit.exercises[0];
const heart = (rank: 'A' | 'K' | 'Q'): Card => ({ suit: 'hearts', rank });
const wrong = exercise.deal.hands.south.find(card => card.suit !== 'hearts')!;
function setup(overrides: Partial<Prompt> = {}) {
  const content: Exercise = { ...exercise, steps: exercise.steps.map(step => step.kind === 'prompt'
    ? { ...step, prompt: { ...step.prompt, ...overrides } } : step) };
  const store = createAttemptStore();
  const player = createPlayer(content, store, 'learner-1');
  player.next();
  for (let i = 0; i < 2; i++) player.advanceScript();
  return { player, store };
}
function continueScript(player: ReturnType<typeof createPlayer>) {
  expect(player.next().stepIndex).toBe(3);
  const end = player.advanceScript();
  expect(end.stepIndex).toBe(4);
  expect(end.view.currentTrick).toEqual([]);
  expect(end.view.tricks[0].cards.at(-1)).toEqual({ seat: 'west', card: exercise.script[2].action.card });
}
test('bundled §4.4 content has five steps, valid card data, text refs and unsigned metadata', () => {
  expect(followSuit.schemaVersion).toBe(1);
  expect(followSuit.gameFormat).toBe('contract-bridge');
  expect(followSuit.exercises).toHaveLength(1);
  expect(exercise.deal.dealId).toBe(dealIdOf(exercise.deal));
  expect(exercise.learnerSide).toBe('northSouth');
  expect(exercise.steps.map(step => step.kind)).toEqual(['commentary', 'scripted-action', 'prompt', 'scripted-action', 'commentary']);
  for (const cards of Object.values(exercise.deal.hands)) expect(cards).toHaveLength(13);
  expect(new Set(Object.values(exercise.deal.hands).flat().map(card => `${card.suit}-${card.rank}`)).size).toBe(52);
  function check(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (key.endsWith('Ref') && typeof entry === 'string' && key !== 'licenceRef') expect(catalogue[entry as keyof typeof catalogue]?.status).toBe('draft');
      if (key === 'signOff') expect(entry).toEqual({ status: 'unsigned-draft' });
      check(entry);
    }
  }
  check(followSuit);
});
test.each(['A', 'K', 'Q'] as const)('accepts equivalent heart %s first time and continues the authored script', rank => {
  const { player, store } = setup();
  expect(player.snapshot().view.currentTrick.map(play => play.card)).toEqual(exercise.script.slice(0, 2).map(play => play.action.card));
  const state = player.answer(heart(rank), 100);
  expect(state.outcome).toBe('correct');
  expect(state.prompt?.expectedAnswers).toEqual(['A', 'K', 'Q'].map(rank => ({ suit: 'hearts', rank })));
  expect(store.snapshot()).toEqual([expect.objectContaining({ learnerId: 'learner-1', promptContentId: 'follow-suit.prompt', version: 1, outcome: 'correct', hintTier: 'none', hintTiming: null, time: 100, playthroughId: expect.any(String) })]);
  player.answer(heart(rank), 101);
  expect(store.snapshot()).toHaveLength(1);
  continueScript(player);
});
test('wrong then right is corrected; wrong twice requires Show me, records failed once and continues', () => {
  const { player, store } = setup();
  const before = player.snapshot().view;
  expect(player.answer(wrong, 1).wrongAnswers).toBe(1);
  expect(player.snapshot().view).toEqual(before);
  expect(player.showAnswer(2).outcome).toBeNull();
  expect(player.answer(heart('K'), 3).outcome).toBe('corrected');
  expect(store.snapshot()[0].outcome).toBe('corrected');
  continueScript(player);
  const failed = setup();
  failed.player.answer(wrong, 1);
  expect(failed.player.answer(wrong, 2).wrongAnswers).toBe(2);
  expect(failed.store.snapshot()).toHaveLength(0);
  expect(failed.player.answer(heart('A'), 3).outcome).toBeNull();
  expect(failed.player.showAnswer(4).outcome).toBe('failed');
  failed.player.showAnswer(5);
  expect(failed.store.snapshot()).toHaveLength(1);
  expect(failed.store.snapshot()[0].outcome).toBe('failed');
  continueScript(failed.player);
});
test.each([true, false, undefined])('countsRejections=%s follows Q3 and preserves the position', countsRejections => {
  const { player } = setup({ countsRejections });
  const before = player.snapshot().view;
  const state = player.answer(wrong, 1);
  expect(state.rejection?.reason).toBe('must-follow-suit');
  expect(state.wrongAnswers).toBe(countsRejections ? 1 : 0);
  expect(state.view).toEqual(before);
  expect(player.answer(heart('A'), 2).outcome).toBe(countsRejections ? 'corrected' : 'correct');
});
test('a legal but unexpected answer is wrong and cannot move the scripted position', () => {
  const { player } = setup({ expectedAnswers: [heart('A')] });
  const before = player.snapshot().view;
  const state = player.answer(heart('Q'), 1);
  expect(state.wrongAnswers).toBe(1);
  expect(state.rejection).toBeNull();
  expect(state.view).toEqual(before);
  expect(player.answer(heart('A'), 2).outcome).toBe('corrected');
});
describe('US-28.8 hints preserve outcomes', () => {
  test.each(['correct', 'corrected', 'failed'] as const)('%s with either hint timing', outcome => {
    for (const timing of ['before-first-answer', 'after-wrong-answer'] as const) {
      if (outcome === 'correct' && timing === 'after-wrong-answer') continue;
      const { player, store } = setup();
      if (timing === 'after-wrong-answer') player.answer(wrong, 1);
      expect(player.showHint().hint).toEqual({ textRef: 'lesson.hint-text', provenance: { sourceKind: 'authored', contentId: 'follow-suit.prompt', version: 1 } });
      if (outcome !== 'correct' && timing === 'before-first-answer') player.answer(wrong, 1);
      player.showHint();
      if (outcome === 'failed') { player.answer(wrong, 2); player.showAnswer(3); }
      else player.answer(heart('A'), 3);
      expect(store.snapshot()[0]).toMatchObject({ outcome, hintTier: 'a', hintTiming: timing });
    }
  });
});
test('session store appends replay attempts and snapshots cannot overwrite history', () => {
  const { player, store } = setup();
  player.answer(heart('A'), 1);
  const replay = createPlayer(exercise, store, 'learner-1');
  replay.next();
  for (let i = 0; i < 2; i++) replay.advanceScript();
  replay.answer(heart('Q'), 2);
  expect(store.snapshot()).toHaveLength(2);
  expect(store.snapshot()[0].playthroughId).not.toBe(store.snapshot()[1].playthroughId);
  expect(Object.isFrozen(store.snapshot()[0])).toBe(true);
  expect(sameCard(player.snapshot().view.currentTrick[2].card, heart('A'))).toBe(true);
});

// §4.4, US-28.8: each Prompt owns its outcome and hint history, including after Show me.
test.each([
  ['next', 'corrected', false], ['next', 'failed', true],
  ['script', 'corrected', true], ['script', 'failed', false],
] as const)('two prompts entered via %s after %s (second hint: %s)', (route, firstOutcome, secondHint) => {
  const first = exercise.steps.find(step => step.kind === 'prompt')!;
  // US-02: South leads as defender; only Robots bridge to the next Prompt.
  const contract = { ...exercise.contract, declarer: 'east' as const };
  const table = startPlaythrough({ ...exercise, contract });
  table.submit('south', 'learner', { kind: 'play-card', card: heart('A') });
  const bridge: ScriptAction[] = [];
  for (const seat of ['west', 'north', 'east'] as const) {
    const action = table.legalActions(seat)[0];
    expect(table.submit(seat, 'robot', action, { kind: 'authored', contentId: exercise.contentId, version: exercise.version }).kind).toBe('accepted');
    bridge.push({ seat, action });
  }
  expect(table.seatView('south').turn).toBe('south');
  const expected = heart('K');
  const content: Exercise = { ...exercise, contract, script: bridge,
    steps: [first, { kind: 'scripted-action', scriptIndices: [0, 1, 2] },
      ...(route === 'next' ? [{ kind: 'commentary' as const, textRef: 'lesson.intro' }] : []),
      { kind: 'prompt', prompt: { ...first.prompt, contentId: 'second-prompt', promptId: 'second-card',
        expectedAnswers: [expected] } },
      { kind: 'commentary', textRef: 'lesson.end' }] };
  const store = createAttemptStore();
  const player = createPlayer(content, store, 'learner-1');
  player.showHint();
  player.answer(wrong, 1);
  expect(player.next().stepIndex).toBe(0);
  if (firstOutcome === 'failed') {
    player.answer(wrong, 2);
    expect(player.next().stepIndex).toBe(0);
    player.showAnswer(3);
  } else player.answer(heart('A'), 3);
  expect(store.snapshot()).toHaveLength(1);
  player.next();
  for (let i = 0; i < bridge.length; i++) player.advanceScript();
  if (route === 'next') player.next();
  const secondIndex = route === 'script' ? 2 : 3;
  expect(player.snapshot()).toMatchObject({ stepIndex: secondIndex, outcome: null, wrongAnswers: 0, rejection: null, hint: null });
  expect(player.next().stepIndex).toBe(secondIndex);
  expect(player.showAnswer(4).outcome).toBeNull();
  if (secondHint) {
    player.answer(heart('A'), 5);
    expect(player.next().stepIndex).toBe(secondIndex);
    expect(player.showHint().hint?.provenance.contentId).toBe('second-prompt');
  }
  expect(player.answer(expected, 6).outcome).toBe(secondHint ? 'corrected' : 'correct');
  player.answer(expected, 7);
  player.showAnswer(8);
  expect(store.snapshot()).toMatchObject([
    { promptContentId: first.prompt.contentId, outcome: firstOutcome, hintTier: 'a', hintTiming: 'before-first-answer', time: 3 },
    { promptContentId: 'second-prompt', outcome: secondHint ? 'corrected' : 'correct',
      hintTier: secondHint ? 'a' : 'none', hintTiming: secondHint ? 'after-wrong-answer' : null, time: 6 },
  ]);
  expect(player.next().stepIndex).toBe(secondIndex + 1);
});

// US-02.2: the learner also plays Dummy, so a prompt on Dummy's turn is answered from Dummy's seat.
test('a prompt on Dummy’s turn submits for Dummy, including Show me', () => {
  const lead: ScriptAction = { seat: 'west', action: { kind: 'play-card', card: { suit: 'hearts', rank: 'J' } } };
  const dummyFollows = exercise.deal.hands.north.filter(card => card.suit === lead.action.card.suit);
  const dummyOther = exercise.deal.hands.north.find(card => card.suit !== lead.action.card.suit)!;
  expect(dummyFollows.length).toBeGreaterThan(0);
  const prompt = exercise.steps.find(step => step.kind === 'prompt')!;
  if (prompt.kind !== 'prompt') throw new Error('fixture');
  const dummyExercise = (countsRejections: boolean): Exercise => ({ ...exercise, contract: { ...exercise.contract, declarer: 'south' }, script: [lead], steps: [
    { kind: 'scripted-action', scriptIndices: [0] },
    { kind: 'prompt', prompt: { ...prompt.prompt, expectedAnswers: dummyFollows, countsRejections } },
  ] });
  const right = createPlayer(dummyExercise(false), createAttemptStore(), 'learner-1');
  right.advanceScript();
  expect(right.answer(dummyFollows[0], 1).outcome).toBe('correct');
  expect(right.snapshot().view.currentTrick.at(-1)).toEqual({ seat: 'north', card: dummyFollows[0] });
  const shown = createPlayer(dummyExercise(true), createAttemptStore(), 'learner-1');
  shown.advanceScript();
  shown.answer(dummyOther, 1); shown.answer(dummyOther, 2);
  expect(() => shown.showAnswer(3)).not.toThrow();
  expect(shown.snapshot()).toMatchObject({ outcome: 'failed' });
  expect(shown.snapshot().view.currentTrick.at(-1)).toEqual({ seat: 'north', card: dummyFollows[0] });
});

// US-28.8: authors can leave a prompt unaided; it then has no hint and records tier none.
test('a prompt without a hint offers none and records hint tier none', () => {
  const { player, store } = setup({ hint: undefined });
  expect(player.showHint().hint).toBeNull();
  player.answer(heart('A'), 1);
  expect(store.snapshot().at(-1)).toMatchObject({ outcome: 'correct', hintTier: 'none', hintTiming: null });
});

// US-02, ADR-0003: until the table turns (#16), lesson content can't ask for a North declarer the screen can't show.
test('only North declarers are rejected at load', () => {
  const north = { ...followSuit, exercises: [{ ...exercise, contract: { ...exercise.contract, declarer: 'north' } }] };
  expect(() => loadLesson(north)).toThrow('cannot be declared by North');
  for (const declarer of ['south', 'east', 'west'] as const) {
    const lesson = { ...followSuit, exercises: [{ ...exercise, contract: { ...exercise.contract, declarer } }] };
    expect(loadLesson(lesson)).toBe(lesson);
  }
});

// US-04.1, CI-5: all scripted moves carry their authored source through JSON replay.
test('scripted records retain authored provenance and round-trip through JSON', () => {
  const { player } = setup();
  player.answer(heart('A'), 1);
  continueScript(player);
  const record = player.record();
  expect(record.actions.filter(entry => entry.controller === 'robot').map(entry => entry.provenance))
    .toEqual(exercise.script.map(() => ({ kind: 'authored', contentId: exercise.contentId, version: exercise.version })));
  expect(record.actions[2].provenance).toEqual({ kind: 'learner' });
  expect(importRecordJson(exportRecordJson(record))).toEqual(record);
});

test('construction rejects any Script entry controlled by the learner', () => {
  for (const declarer of ['west', 'south'] as const) {
    const seat = declarer === 'west' ? 'south' : 'north';
    expect(() => createPlayer({ ...exercise, contract: { ...exercise.contract, declarer }, script: [
      { seat, action: { kind: 'play-card', card: exercise.deal.hands[seat][0] } },
    ] }, createAttemptStore(), 'learner-1')).toThrow('learner-controlled seat');
  }
});

// US-27.3a: an accepted alternative can deliberately retain the canonical continuation.
test('acceptThenScripted records a correct answer and plays the canonical card', () => {
  const { player, store } = setup({ acceptThenScripted: [heart('K')] });
  expect(player.answer(heart('K'), 100).outcome).toBe('correct');
  expect(store.snapshot()[0].outcome).toBe('correct');
  expect(player.record().actions[2].action.card).toEqual(heart('A'));
  expect(player.snapshot().view.hand).toContainEqual(heart('K'));
  continueScript(player);
});
