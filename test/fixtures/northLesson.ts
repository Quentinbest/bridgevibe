import { followSuit, loadLesson } from '../../src/curriculum/content';
import type { Prompt, Step, ScriptAction } from '../../src/curriculum/model';
import { startPlaythrough } from '../../src/table';

// US-02.3: unpublished fixture with one Prompt in each declaring hand.
const source = followSuit.exercises[0];
const contract = { ...source.contract, declarer: 'north' as const };
const table = startPlaythrough({ ...source, contract });
const prompt = source.steps.find(step => step.kind === 'prompt')!.prompt;
const script: ScriptAction[] = [];
const steps: Step[] = [];
for (let index = 0; index < 4; index++) {
  const seat = table.seatView('north').turn!;
  const action = table.legalActions(seat)[0];
  const controller = table.controllerOf(seat);
  if (controller === 'robot') {
    steps.push({ kind: 'scripted-action', scriptIndices: [script.length] });
    script.push({ seat, action });
  } else {
    const answer: Prompt = { ...prompt, contentId: `north-fixture.${seat}`, promptId: `north-fixture.${seat}`,
      expectedAnswers: [action.card], acceptThenScripted: undefined };
    steps.push({ kind: 'prompt', prompt: answer });
  }
  table.submit(seat, controller, action, controller === 'robot' ? { kind: 'authored', contentId: 'north-fixture', version: 1 } : undefined);
}
export const northLesson = loadLesson({ ...followSuit, contentId: 'north-fixture',
  exercises: [{ ...source, contentId: 'north-fixture.exercise', contract, script, steps }] });
