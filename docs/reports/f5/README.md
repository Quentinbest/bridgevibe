# F5 teacher grading (VAL-08, #108)

Regenerate with Node 24: `npm run f5:export`. The Node test writes these files only when `F5_REPORT=1`.

VAL-08 requires **0 critical factual errors** and **at least 90% rated clear (provisional)**. These files are ungraded inputs, not evidence that the gate passes.

Both teachers grade independently using the blank yes/no columns, then resolve every disagreement in Resolution note **before scoring**. A critical factual error would teach a beginner something wrong. Judge clarity for teenage beginners on a phone. Score the agreed clarity answers across all rows; any agreed critical error fails the gate. Leave no unresolved or ungraded rows when scoring.

All wording is **draft (CI-8)**. The F4-derived verdicts rest on **AI labels under PRD D10**, including AI adjudication; teacher review remains pending and can overrule them.

## Reproduction and coverage

The generator replays seeded F4 positions from test/f4/records.ts through the real Table, completes candidates with principlesPolicy robots and first-legal learner continuation, and uses bridge-dds 1.4.0 / DDS 2.9. It selects the first occurrence of each verdict, its short label and its VISIBLE alternative when present. Labels and sentences occupy separate rows because KeyMoments renders them in separate paragraphs; wording follows ReviewScreen's provenance rendering, including its hindsight suffix on labels. Six trick-cost rows cover values 0, 1, 2, 3, 4 and 7, in that order, selected from all analysed F4 continuations and the sampled practice line by earliest position index, with stable traversal order breaking ties. Three fixed F4 positions supply hints. The seeded bv-issue-27 practice line supplies sampled quality and a naturally forced-card hint. Setup's uncovered contract-choice supplies hint.not-covered.

Cost 5 is intentionally omitted under the owner's six-row selection so cost 7, the largest reached cost, is included.

Production sample counts are unchanged. Offline solver requests use an infinite deadline so machine speed cannot select outputs; no latency claim is made. Every original coach entry passes validateEntry before normalization. Table's process-local Playthrough counters are renamed in first-appearance order, preserving entry IDs and session grouping. at/exportedAt use the fixed fixture epoch 2026-10-26T00:00:00.000Z; durationMs is normalized to 0 together with exceededTarget=false. Neither timing field appears in the CSV. App version is imported from src/app/appVersion.ts (0.0.0), supplied by Vitest's build define.

Counts: hint: 4; abstention: 3; moment verdict: 4; moment label: 4; moment alternative: 2; trick cost: 6; sampled quality: 1; lesson step: 16.

Fault-injected rows: F5-02 (no-layout), F5-03 (error). They exercise the existing faultHintRunner; all other outputs use real modules without injected solver results.

VISIBLE context comes only from the historical learner Seat View and the learner's reviewed play. ALL_HANDS review rows explicitly label hindsight, retain that historical view, identify the reviewed play and show all four remaining hands for checking the outcome. Suit symbols and short ranks describe cards. The JSON retains full provenance and uses the existing bridgevibe-f5 schemaVersion 1 envelope with additive ref, outputKind, visibleContext, source and grading-context metadata.

## Lesson

The app's Home link serves follow-suit-full, version 2. Every step is exported in order through the real lesson player. Prompt rows include the exact catalogue wording for commentary, prompt, feedback and optional hint branches, in that order; these variants are alternatives, not simultaneous screen text. wordingVariants in JSON identifies each branch. Script and Exposure rows carry their actual status wording. Authored Exposure is separately identified and never enters computed VISIBLE analysis. Each row retains the owning contentId/version and draft signOff. The traversal chooses the first accepted answer to advance; feedback variants remain available for grading.

The CSV is RFC 4180 (quoted cells, escaped quotes, CRLF). There is one row per coach output and per lesson step; all teacher fields and resolution notes are blank. The JSON grade and graderNote fields remain null. Regenerating twice must produce byte-identical JSON, CSV and README.
