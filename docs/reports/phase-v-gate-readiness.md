# Phase V gate readiness (2026-10-26, updated 2026-10-30)

Where each validation item (PRD §13.7) stands at `main` bd798dd, for the technology selection gate (PRD §14). The owner decides the gate; this report only collects the evidence and names what is missing.

**Summary.** Of the 10 items that block the gate, 5 are met by automated suites that run in CI, 1 is met on AI labels, and 4 are waiting: on the owner's phone runs (VAL-04), on the teachers (VAL-08, VAL-11), and on the licence questions (VAL-10). VAL-08's input, the F5 export, is merged (#108); only the teachers' grading is missing.

## Items

| Item | Blocks the gate | Status | Evidence | What is missing |
| --- | --- | --- | --- | --- |
| VAL-01 Rules (F1) | Yes | Met | `src/table/playthrough.test.ts`, `src/table/miniBridge.test.ts`, in Node and Chromium (US-05.1); CI | — |
| VAL-02 Scoring (F6) | Yes | Met | `src/table/scoring.test.ts` (2,940 cases, two references, 16 Law 77 examples), `src/table/miniBridgeScoring.test.ts` | — |
| VAL-03 Solver correctness (F2) | Yes, per candidate | Met for bridge-dds, macroxue and DDS 3.1 single-threaded | `src/analysis/f2.test.ts` (100 deals, 200 positions; #22, #63) | DDS 3.1 threaded (#82, on hold); pons-dds not integrated |
| VAL-04 Device performance (T2, F7) | Yes: decides browser versus server | **Waiting: owner** | Harness merged (#106), `?bench=1` on an internal build | The iPhone 16 and Pixel 9 runs, attached to #28 |
| VAL-05 Information boundary (F3) | Yes | Met | `test/f3Permutation.test.ts`, the Seat View type boundary (ADR-0001), ESLint and dependency-cruiser rules (#25) | — |
| VAL-06 Abstention | Yes | Met | `src/app/analysisFaults.test.tsx`, `test/e2e/analysis-faults.spec.ts` (#21, #24) | — |
| VAL-07 Review labelling (F4) | Yes | **Met on AI labels** | [`val-07.md`](val-07.md): 0 acceptable plays called mistakes, every hindsight output labelled | Teachers' review of the 23 adjudicated options (#100). Under D10 the result measures the coach against AI annotators, not teachers |
| VAL-08 Teacher grading (F5) | Yes | **Waiting: teachers** | [`f5/`](f5/): 24 coach outputs and the 16 lesson steps, each with its visible context and provenance (#108) | Both teachers' grades (`f5/f5-sheet.csv`) |
| VAL-09 Learner observation | No | Not planned | — | Optional (T7b) |
| VAL-10 Licence bill of materials (T3) | Yes | **Open** | [`licence-candidates.md`](licence-candidates.md); the build's licence check (#3, #37, #38) | The solver candidates all pass. Every bidding candidate has an open or failed row; see below |
| VAL-11 Bidding comparison (T5) | Yes, for bidding | **Waiting: teachers** | [`t5/`](t5/): 30 auctions, rusty-bidding-bot and saycbridge run | Both teachers' grades (`t5/t5-sheet.csv`). Bridgit not run (no .NET); pons dropped (D11) |
| VAL-12 Fair feedback (T6) | No | Measured | [`fair-feedback.md`](fair-feedback.md): double-dummy alone would blame 27 of 100 acceptable plays | On AI labels, like VAL-07 |

## Risks for the decision

- **Bidding candidates and the licence rules.** No bidding candidate yet passes every licence rule (LR-1 to LR-7):
  - rusty-bidding-bot fails LR-3 on test fixtures and notes that mention BBA or EPBot, and its stock convention cards need their origin checked (LR-5, LR-6, DEP-08);
  - saycbridge has unscanned files (LR-3 and LR-7 open);
  - Bridgit passes but hasn't been run;
  - pons was dropped by the owner (D11, 2026-10-30).

  If the two teachers rate rusty-bidding-bot best, its shipped artefact (the WebAssembly bidder and the cards it loads) needs its own assessment, separate from the checkout's fixtures.
- **pons (decided).** Removing its `american_bba_*` weights would not have settled LR-3: upstream records that the deterministic floor was modelled on a reverse-engineering of EPBot (`docs/ai-bidder/bba-floor.md` §5) and that many defaults were tuned against BBA (`src/bidding/instinct.rs`). The owner dropped pons as a bidding candidate (PRD D11, 2026-10-30) and #34 is closed.
- **Labels are AI's.** VAL-07 and VAL-12 measure against AI annotators with AI adjudication (D10). The adjudicator called 21 of the 23 disputed options acceptable, which makes the yardstick lenient until the teachers have reviewed them (#100).
- **Robots.** In the 20-deal F7 sample, 157 of 1,040 robot plays (15%) used the `fallback-lowest` rule, meaning no principle applied. The teachers' review (#96, US-11.3) will show how many of those are wrong.
- **Wording.** All 289 learner-facing strings are drafts (CI-8). DEP-04 (reason codes, abstentions, the hindsight label and the verdicts) was due in week 3.

## What happens next

| Waiting on | What | Unblocks |
| --- | --- | --- |
| Owner | Phone runs for #28 | VAL-04, the solver choice, and whether #82 is needed |
| Teachers | The five-task pack: T5 grading, #100, F7 review (#96), wording, F5 grading | VAL-11, VAL-07 on teacher labels, DEP-02/DEP-03, DEP-04, VAL-08 |
| Owner | DEP-08 licence questions (convention cards) | VAL-10 for the bidding choice |
