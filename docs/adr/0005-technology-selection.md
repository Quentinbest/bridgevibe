# ADR-0005: Technology selection for the MVP

- **Status:** Proposed. A draft for the gate (PRD §14); nothing here is decided until the owner approves it, with the engineering lead and the teaching advisor.
- **Date:** 2026-11-02
- **Related:** PRD §12, §13.7, §13.9 (deliverable 11), §14; D1, D10, D11; [gate readiness](../reports/phase-v-gate-readiness.md), [candidate register](../reports/candidate-register.md), [MVP estimate](../reports/mvp-estimate.md); #125

## Context

Phase V built a MiniBridge slice on the component path, and tracks T1 to T8 gathered evidence for the gate (PRD §13). This record states each gate decision with its selection rule, the evidence so far and a recommendation. Two pieces of evidence are still missing:
- the device benchmarks on the iPhone 16 and Pixel 9 (#28), which decide the solver and whether analysis can stay in the browser;
- the teachers' grades of the bidding comparison (T5), which decide the bidding engine.

Decisions that depend on them say so and give the rule that will settle them.

## Decisions

| Decision (PRD §14) | Recommendation | Status | Evidence |
| --- | --- | --- | --- |
| **Solver binding and location** | Browser: **macroxue/bridge-solver** if it passes VAL-04 on both phones, being the smallest passing candidate (72 KB WebAssembly); otherwise bridge-dds; otherwise DDS 3.1. If none passes VAL-04, analysis moves to a server and NFR-C3 (offline) is re-decided | **Pending #28** | All three pass F2 (VAL-03: #22, #63). No phone data yet. The threaded DDS 3.1 build (#82) is needed only if no single-threaded build meets the budgets |
| **Rules core** | **Our own TypeScript core** | Ready | F1 and F6 pass (VAL-01, VAL-02). It is the single authority (INV-1) in the browser and in Node (FR-R6). ts-contractbridge isn't needed |
| **Foundation** | **Assemble components** (the slice's path) | Ready | T4 fails at the cited commit: Bridge-Classroom can't run offline, depends on BBA at run time, and gives a false "matched the BBA" verdict ([fit report](../reports/bridge-classroom-fit.md)). Adapting it is estimated at 35–54 engineer-days plus 15–25 to port, against the rule's "at least 25% lower" |
| **Bidding engine** | The candidate with the **highest teacher accuracy** (VAL-11 at least 90%, *provisional*) that has complete provenance and explicit "not covered" abstentions. If none passes, **author our own rule tables** in rusty-bidding-bot's `.bid` format | **Pending the T5 grades** | rusty-bidding-bot and saycbridge ran on 30 auctions ([`t5/`](../reports/t5/)). Bridgit wasn't run (no .NET, owner 2026-10-31). pons was dropped (D11). The two new TypeScript bidding apps found by T8 are left out (owner, 2026-11-02). Licence: rusty-bidding-bot fails LR-3 on test fixtures, with LR-5/6 open for its stock convention cards; saycbridge has LR-3/7 open, and it is a Python and Z3 server, which is a poor fit for an offline browser app |
| **Robot policy (MVP)** | **Heuristics**: the principles policy (DEP-03), extended for the auction with the chosen bidding engine. Sampled double-dummy robots only if the teachers' F7 review shows the heuristics teach wrong play and T2 shows the budget allows it | Ready; teacher review pending | F7 soak: 100 Deals, 0 rejected cards (#13). 15% of plays fall back to the lowest card (`fallback-lowest`), so the teachers' review is #96. BEN stays excluded (LR-3, LR-4, GPL) |
| **Backend** | **None** for the MVP, if the chosen solver and bidding engine both run in the browser | **Pending #28 and the T5 grades** | No other Must requirement needs one: progress is local-first (FR-P4), and robots, hints and review run in the browser. Two outcomes would need a service: no browser solver meeting VAL-04, or saycbridge winning T5. saycbridge is a Python and Z3 server, so FR-B1–B5 would then need a bidding service or a browser port of its Z3 solver, and offline bidding (NFR-C3) would have to be re-decided |
| **Language-model phrasing** | **No** | Ready; teacher grading pending | All coach text comes from catalogue templates (CI-8). F5 grading (VAL-08) will show whether the templates are clear; language-model phrasing would need CI-7 implemented first |

## Consequences

- The slice's code is the MVP's base:
  - the rules core;
  - the Seat View boundary and its checks (ADR-0001, F3);
  - the solver adapters;
  - the coach layer: hints, trick cost, key moments, sampled quality and abstentions;
  - provenance.

  The [MVP estimate](../reports/mvp-estimate.md) counts only what is still to build.
- The MVP adds the full auction, duplicate scoring and the bidding curriculum. The bidding engine's licence findings must be cleared for whatever ships, not for the candidate's whole checkout (LR-3).
- **If no browser solver meets the phone budgets,** offline review (FR-RV5) degrades. The MVP then needs a small analysis service, and NFR-C3 has to be re-decided. That would add an estimated 8–12 engineer-days.
- **If saycbridge wins the bidding comparison,** the MVP needs a bidding service (an estimated 10–15 engineer-days, and NFR-C3 re-decided for bidding) or a browser port of Z3, which is of uncertain size. Either way, the estimate's "engine in a worker" assumption no longer holds.
- **The MVP ships in English and Simplified Chinese (D4).** The i18n work in `docs/i18n/implementation-plan.md` is part of the MVP estimate.
- **Delegated to Claude:** the wording of each recommendation and the provisional ordering of the solver candidates. The selection rules themselves are the PRD's.
