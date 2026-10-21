import type { Card } from '../table';
import type { Attempt, AttemptSink, Lesson } from './model';
import { createPlayer } from './player';

// US-21.7, FR-P1: one Table Playthrough per Exercise; counts belong only to this run.
export function createLessonPlayer(lesson: Lesson, sink: AttemptSink, learnerId: string) {
  const attempts: Attempt[] = [];
  const store: AttemptSink = { append(attempt) { attempts.push({ ...attempt }); sink.append(attempt); } };
  let exerciseIndex = 0;
  let player = createPlayer(lesson.exercises[0], store, learnerId);
  const steps = lesson.exercises.flatMap((exercise, index) => exercise.steps.map(step => ({
    exerciseIndex: index, kind: step.kind,
  })));
  function snapshot() {
    const state = player.snapshot();
    const stepIndex = lesson.exercises.slice(0, exerciseIndex).reduce((sum, exercise) => sum + exercise.steps.length, 0) + state.stepIndex;
    const complete = state.complete && exerciseIndex === lesson.exercises.length - 1;
    return { ...state, exerciseIndex, totalExercises: lesson.exercises.length,
      exerciseStepIndex: state.stepIndex, exerciseTotalSteps: state.totalSteps,
      stepIndex, totalSteps: steps.length, steps, complete,
      summary: complete ? { rightFirstTime: attempts.filter(attempt => attempt.outcome === 'correct').length,
        afterANudge: attempts.filter(attempt => attempt.outcome === 'corrected').length,
        skillTags: [...lesson.skillTags] } : null };
  }
  function transition(action: () => unknown) {
    if (snapshot().complete) return snapshot();
    action();
    if (player.snapshot().complete && exerciseIndex < lesson.exercises.length - 1) {
      player = createPlayer(lesson.exercises[++exerciseIndex], store, learnerId);
    }
    return snapshot();
  }
  return { snapshot, record: () => player.record(),
    next: () => transition(() => player.next()),
    advanceScript: () => transition(() => player.advanceScript()),
    answer: (card: Card, time: number) => transition(() => player.answer(card, time)),
    showAnswer: (time: number) => transition(() => player.showAnswer(time)),
    showHint: () => transition(() => player.showHint()) };
}
