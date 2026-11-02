# MVP estimate

Gate deliverable 12 (PRD §13.9): an estimate for the recommended path (assemble components, [ADR-0005](../adr/0005-technology-selection.md)) and a rough one for the rejected alternative (adapt Bridge-Classroom). Draft, 2026-11-02; every figure is an *estimate* in engineer-days (ed), and content and teacher time are counted separately (RK-13).

**Headline.** The recommended path is about **107–163 engineer-days** of software work, or **122–188** if we have to author our own bidding rule tables. That includes the English and Simplified Chinese launch (D4). Content production adds:
- **47–73 author days**, of which 12–18 are Simplified Chinese;
- **52–78 teacher days**: two teachers, plus a Chinese-speaking bridge teacher for the `zh-Hans` sign-off;
- the release work in PRD §16: an accessibility audit and a pilot.

With two engineers that is roughly **11–19 weeks** of engineering, if content runs in parallel.

The Bridge-Classroom path is roughly **125–214 engineer-days** before the same content work. Adding the same bilingual work (18–26) gives 143–240. That is not lower, let alone 25% lower, so the Foundation rule (adapt only if at least 25% cheaper) points to assembling components.

## What the slice already provides

These carry over at production standard (PRD §13 "code status"):
- the rules core with F1/F6;
- duplicate scoring under Law 77 (F6, 2,940 cases);
- PBN import and export;
- Seat Views and the information boundary (ADR-0001, F3);
- the solver adapters (F2);
- the robot worker and principles policy;
- the lesson player and content validation;
- hints with abstention;
- review, with trick cost, key moments, sampled quality and fault handling;
- provenance and the F5 export;
- the licence check;
- the device bench.

The estimate below counts only what the MVP adds.

## Recommended path: assemble components

| Area (PRD requirements) | What is new for the MVP | Estimate (ed) |
| --- | --- | --- |
| Auction in the Table (FR-R1, FR-R3) | Calls, legality, doubles and redoubles, the contract from the auction, dealer and vulnerability, auction replay and review, F1 cases for the auction | 8–12 |
| Undo, retry and resume (FR-R9, FR-R10, FR-RV4) | Branching playthroughs, persisted in-progress state, retry from a key moment without recording attempts | 6–9 |
| Bidding engine integration (FR-B1–B5, FR-E4) | The convention profile; the chosen engine in a worker; rule IDs and "not covered" abstentions; bid feedback against expectation plus teacher-accepted alternatives; call meanings on demand | 12–18 |
| …if no candidate passes VAL-11 | Author our own beginner rule tables in `.bid` format, with tests per rule | +15–25 |
| Robots in the auction (FR-B2, FR-BOT5) | Robots bid with the profile; pluggable policy interface | 3–5 |
| Lesson player for bidding and the curriculum structure (FR-L1–L3, FR-L6) | Bidding prompts, staged commentary for auctions, modules and levels, prepared exercises before random deals | 8–12 |
| Content pipeline and teacher workflow (FR-L4, FR-L5, FR-C1–C4) | Constrained deal generation, checks that each deal teaches its point, per-item sign-off and rights records | 8–12 |
| Progress (FR-P1–P5) | Local-first storage, attempt outcomes, skill tags, export and import, next-practice suggestion | 8–12 |
| Explanations and settings (FR-E2, FR-E5, FR-H4, FR-S1, FR-S2) | Rules reference and glossary, hint reasons, settings and role mix | 6–9 |
| Review offline (FR-RV5) and performance (NFR-P1–P6) | Depends on the #28 results; tuning to the budgets | 4–8 |
| Accessibility to WCAG 2.2 AA (§16.6) | Fixes from an audit of the core journeys (the slice already runs axe in e2e) | 5–8 |
| Hardening and release | Error handling, packaging, CI, and the licence bill of materials for the release | 6–10 |
| English and Simplified Chinese (NFR-I, D4) | Tickets I-01 to I-10, I-12 and I-15 of [`docs/i18n/implementation-plan.md`](../i18n/implementation-plan.md): catalogue split, message formatter, locale runtime, language setting, guards and pseudo-locale, CJK fonts, Locale Glossary format, per-locale sign-off, offline locale caching. The plan sizes them at about 6,000 changed lines | 18–26 |
| Contingency on the above | About 15% for integration surprises | 15–22 |
| **Total** | Without own rule tables, and with them | **107–163, or 122–188** |

If the solver has to move to a server (VAL-04 fails on the phones), add **8–12 ed** for a small analysis service and degraded offline review. If saycbridge wins T5, add **10–15 ed** for a bidding service, or a browser port of Z3 of uncertain size. Either way, NFR-C3 is re-decided for that part.

### Content and teacher time

The curriculum (FR-L2) has 10 modules. Assume about 3 lessons a module, each with about 6 prompts and 2–3 authored deals: about 30 lessons, 180 prompts and 75 deals.

| Work | Who | Estimate |
| --- | --- | --- |
| Drafting lessons, prompts, commentary and deals | Content author (a teacher, or an engineer with a teacher) | 1–1.5 days a lesson: **35–55 author days** |
| Teacher review and sign-off of each lesson, template and explanation (CI-8, FR-C3) | Two teachers | About 0.5 day a lesson each: **30–40 teacher days** |
| Bidding profile and regression set (FR-B1, FR-B4, VAL-11 at MVP scale) | Teachers | **5–10 teacher days** |
| Pilot with 10–20 beginners (§16.7) and acting on its findings | Teachers and owner | **5–10 days**, plus fixes inside the hardening line above |
| Simplified Chinese: Locale Glossary (I-11), catalogue and lesson text (I-13) | Translator-author with bridge knowledge | **12–18 author days** |
| `zh-Hans` review and sign-off by a teacher who knows bridge in Chinese (D4, U-19) | A third teacher | **12–18 teacher days**: the longest step on the i18n plan's critical path (spec R-1) |

These figures assume the Phase V teacher work (the five-task pack) is done first, since it settles DEP-02/03/04, the F4 labels and the bidding choice.

## Rejected alternative: adapt Bridge-Classroom

Rough, from the [T4 fit report](bridge-classroom-fit.md):

| Work | Estimate (ed) |
| --- | --- |
| Make it fit the requirements: offline, BBA removal, MiniBridge or full-auction coaching, the learner defending, the information boundary, our coach | 35–54 |
| Port to React and TypeScript, or accept Vue and Rust (PRD §14 asks whether the stack is acceptable) | 0 or 15–25 |
| The MVP features it lacks, net of its lesson UI, progress tracking and classroom features: auction coaching to our rules, progress model (FR-P3 denominators), content pipeline checks, accessibility, hardening | 60–90 |
| Re-verify our fixture suites (F1–F7) against its engine, or replace its engine with our core | 15–25 |
| Contingency on a young external codebase | 15–20 |
| **Total** | **125–214** |

Content and teacher time are about the same on both paths. Its Baker-Bridge lessons would need the LR-5 rights question settled before reuse.

## Assumptions and what would change the numbers

- The bidding engine passes VAL-11 and runs in the browser. If none passes, the "own tables" line applies (+15–25 ed). If saycbridge wins, the bidding-service line applies.
- A browser solver passes VAL-04 on both phones. If not, add the server option (+8–12 ed) and re-decide NFR-C3.
- The teachers sign off within the slice's draft structures. Large rewrites of the coach wording (F5, DEP-04) would add rework.
- These are planning ranges, not commitments. The slice's own estimate was about 34 engineer-days for the required tracks (PRD §13). It is the only calibration point.
- **Delegated to Claude:** the work breakdown, the per-lesson rates and the curriculum size assumptions. The owner and the engineering lead should review them before the gate.
