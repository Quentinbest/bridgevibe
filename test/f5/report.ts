import assert from 'node:assert/strict';
import { APP_VERSION } from '../../src/app/appVersion';
import { createProvenanceLog, validateEntry, type LogEntry } from '../../src/coach/provenance';
import { lessonById } from '../../src/curriculum/content';
import { createLessonPlayer } from '../../src/curriculum/lessonPlayer';
import { cardName, text, type StringId } from '../../src/explanation';
import { card, generateCoach, visibleContext } from './generate';

// VAL-08: fixed metadata replaces wall clocks; this is a fixture epoch, not a run timestamp.
const epoch = '2026-10-26T00:00:00.000Z';
export const columns = ['Ref', 'Kind', 'Information mode', 'What the learner could see', 'Wording shown', 'Source',
  ...['A', 'B'].flatMap(teacher => ['factually correct (yes/no)', 'critical error (yes/no)', 'clear (yes/no)', 'note'].map(field => `Teacher ${teacher} ${field}`)), 'Resolution note'];
export const csv = (rows: readonly (readonly string[])[]) => rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
function source(entry: LogEntry): string {
  const p = entry.provenance;
  if (p.sourceKind === 'engine') return `engine ${p.name} ${p.version}, ${p.sampleCount} samples${p.hint ? `, sampler ${p.hint.sampler} ${p.hint.samplerVersion}` : ''}${p.sampled ? `, sampler ${p.sampled.sampler} ${p.sampled.samplerVersion}, seed ${p.sampled.seed}` : ''}`;
  if (p.sourceKind === 'authored') return `authored ${p.contentId}, version ${p.version}`;
  if (p.sourceKind === 'template') return `template ${p.templateId}`;
  return JSON.stringify(p);
}
function lessonOutputs() {
  const lesson = lessonById('follow-suit-full')!;
  const player = createLessonPlayer(lesson, { append() {} }, 'f5');
  const outputs = [];
  while (!player.snapshot().complete) {
    const state = player.snapshot(), exercise = lesson.exercises[state.exerciseIndex];
    const step = exercise.steps[state.exerciseStepIndex];
    const content = step.kind === 'prompt' ? step.prompt : exercise;
    const variants: { when: string; wording: string }[] = [];
    const add = (when: string, key: string, params = {}) => variants.push({ when, wording: text(key as StringId, params) });
    if (step.kind === 'commentary') add('commentary', step.textRef);
    if (step.kind === 'scripted-action') add('scripted-action', 'lesson.watch');
    if (step.kind === 'exposure') { add('exposure', 'lesson.exposure-note'); add('exposed card caption', 'lesson.exposed'); }
    if (step.kind === 'prompt') {
      const p = step.prompt, answers = p.expectedAnswers.map(cardName).join(', ');
      add('commentary', p.commentaryRef); add('prompt', p.textRef);
      add('correct or corrected', p.correctRef, { answers }); add('wrong', p.wrongRef);
      add('first wrong answer', 'lesson.retry'); add('show answer', p.shownRef, { answers });
      if (p.hint) add('hint requested', p.hint.textRef);
    }
    const entry: LogEntry = { id: `f5-lesson-${state.stepIndex}`, playthroughId: player.record().playthroughId,
      positionIndex: state.view.positionIndex, kind: 'statement', summary: `lesson-step-${step.kind}`,
      text: variants.map(v => v.wording).join('\n'), informationMode: 'VISIBLE', at: epoch,
      provenance: { sourceKind: 'authored', contentId: content.contentId, version: String(content.version) } };
    assert.deepEqual(validateEntry(entry), []);
    outputs.push({ entry, outputKind: 'lesson step' as const, stepKind: step.kind, stepIndex: state.stepIndex,
      exerciseId: exercise.contentId, contentId: content.contentId, version: content.version, signOff: content.signOff,
      wordingVariants: variants, fault: null,
      visibleContext: `${visibleContext(state.view)}${state.exposed.length ? `\nAuthored lesson Exposure (presentation only): ${state.exposed.map(e => `${e.seat} ${card(e.card)}`).join(', ')}` : ''}` });
    if (step.kind === 'scripted-action') step.scriptIndices.forEach(() => player.advanceScript());
    else { if (step.kind === 'prompt') player.answer(step.prompt.expectedAnswers[0], 0); player.next(); }
  }
  return { lesson: { contentId: lesson.contentId, version: lesson.version, signOff: lesson.signOff, title: text(lesson.titleRef as StringId) }, outputs };
}
export async function generateReport() {
  const coach = await generateCoach(), lesson = lessonOutputs();
  const log = createProvenanceLog(APP_VERSION);
  const outputs = [...coach, ...lesson.outputs];
  const playthroughIds = new Map<string, string>();
  for (const output of outputs) {
    const entry = structuredClone(output.entry);
    // VAL-08: Table session counters are process-local; preserve grouping with stable fixture IDs.
    if (!playthroughIds.has(entry.playthroughId)) playthroughIds.set(entry.playthroughId, `f5-playthrough-${playthroughIds.size + 1}`);
    const stableId = playthroughIds.get(entry.playthroughId)!;
    entry.id = entry.id.replaceAll(entry.playthroughId, stableId);
    entry.playthroughId = stableId;
    entry.at = epoch;
    if (entry.provenance.sourceKind === 'engine' && entry.provenance.hint) {
      entry.provenance.hint.durationMs = 0; entry.provenance.hint.exceededTarget = false;
    }
    log.record(entry);
  }
  // US-40.1: additive fields retain the existing schemaVersion 1 debug export envelope.
  const exported = log.export();
  const entries = exported.entries.map((entry, index) => {
    const { entry: original, ...metadata } = outputs[index];
    return { ...entry, ...metadata, ref: `F5-${String(index + 1).padStart(2, '0')}`, source: source(original) };
  });
  const json = { ...exported, exportedAt: epoch, lesson: lesson.lesson, entries };
  const sheet = csv([columns, ...entries.map(entry => [entry.ref, entry.outputKind, entry.informationMode,
    entry.visibleContext, entry.text!, `${entry.source}${entry.fault ? `; FAULT-INJECTED: ${entry.fault}` : ''}${'verdict' in entry && entry.verdict ? `; F4 ${entry.verdict}; AI labels (PRD D10)` : ''}`,
    ...Array<string>(9).fill('')])]);
  const counts = Object.fromEntries([...new Set(entries.map(e => e.outputKind))].map(kind => [kind, entries.filter(e => e.outputKind === kind).length]));
  const readme = `# F5 teacher grading (VAL-08, #108)

Regenerate with Node 24: \`npm run f5:export\`. The Node test writes these files only when \`F5_REPORT=1\`.

VAL-08 requires **0 critical factual errors** and **at least 90% rated clear (provisional)**. These files are ungraded inputs, not evidence that the gate passes.

Both teachers grade independently using the blank yes/no columns, then resolve every disagreement in Resolution note **before scoring**. A critical factual error would teach a beginner something wrong. Judge clarity for teenage beginners on a phone. Score the agreed clarity answers across all rows; any agreed critical error fails the gate. Leave no unresolved or ungraded rows when scoring.

All wording is **draft (CI-8)**. The F4-derived verdicts rest on **AI labels under PRD D10**, including AI adjudication; teacher review remains pending and can overrule them.

## Reproduction and coverage

The generator replays seeded F4 positions from test/f4/records.ts through the real Table, completes candidates with principlesPolicy robots and first-legal learner continuation, and uses bridge-dds ${bridgeDdsAdapterVersion(coach)}. It selects the first occurrence of each verdict, its short label and its VISIBLE alternative when present. Labels and sentences occupy separate rows because KeyMoments renders them in separate paragraphs; wording follows ReviewScreen's provenance rendering, including its hindsight suffix on labels. Six trick-cost rows cover values 0, 1, 2, 3, 4 and 7, in that order, selected from all analysed F4 continuations and the sampled practice line by earliest position index, with stable traversal order breaking ties. Three fixed F4 positions supply hints. The seeded bv-issue-27 practice line supplies sampled quality and a naturally forced-card hint. Setup's uncovered contract-choice supplies hint.not-covered.

Cost 5 is intentionally omitted under the owner's six-row selection so cost 7, the largest reached cost, is included.

Production sample counts are unchanged. Offline solver requests use an infinite deadline so machine speed cannot select outputs; no latency claim is made. Every original coach entry passes validateEntry before normalization. Table's process-local Playthrough counters are renamed in first-appearance order, preserving entry IDs and session grouping. at/exportedAt use the fixed fixture epoch ${epoch}; durationMs is normalized to 0 together with exceededTarget=false. Neither timing field appears in the CSV. App version is imported from src/app/appVersion.ts (${APP_VERSION}), supplied by Vitest's build define.

Counts: ${Object.entries(counts).map(([kind, count]) => `${kind}: ${count}`).join('; ')}.

Fault-injected rows: ${entries.filter(e => e.fault).map(e => `${e.ref} (${e.fault})`).join(', ')}. They exercise the existing faultHintRunner; all other outputs use real modules without injected solver results.

VISIBLE context comes only from the historical learner Seat View and the learner's reviewed play. ALL_HANDS review rows explicitly label hindsight, retain that historical view, identify the reviewed play and show all four remaining hands for checking the outcome. Suit symbols and short ranks describe cards. The JSON retains full provenance and uses the existing bridgevibe-f5 schemaVersion 1 envelope with additive ref, outputKind, visibleContext, source and grading-context metadata.

## Lesson

The app's Home link serves ${lesson.lesson.contentId}, version ${lesson.lesson.version}. Every step is exported in order through the real lesson player. Prompt rows include the exact catalogue wording for commentary, prompt, feedback and optional hint branches, in that order; these variants are alternatives, not simultaneous screen text. wordingVariants in JSON identifies each branch. Script and Exposure rows carry their actual status wording. Authored Exposure is separately identified and never enters computed VISIBLE analysis. Each row retains the owning contentId/version and draft signOff. The traversal chooses the first accepted answer to advance; feedback variants remain available for grading.

The CSV is RFC 4180 (quoted cells, escaped quotes, CRLF). There is one row per coach output and per lesson step; all teacher fields and resolution notes are blank. The JSON grade and graderNote fields remain null. Regenerating twice must produce byte-identical JSON, CSV and README.
`;
  return { json, sheet, readme, counts };
}
function bridgeDdsAdapterVersion(outputs: Awaited<ReturnType<typeof generateCoach>>) {
  const engine = outputs.find(o => o.entry.provenance.sourceKind === 'engine')!.entry.provenance;
  return engine.sourceKind === 'engine' ? engine.version : '';
}
