# Domain model: open questions, edge cases and PRD inconsistencies

Companion to `GLOSSARY.md`. Each question states a recommended default. When a question is answered, the glossary entry loses its **[Provisional]** marker and the answer is recorded here.

## 1. Questions (all resolved 2026-10-18)

| ID | Question | Edge case that forces it | Recommended default |
|---|---|---|---|
| Q1 | Who controls Declarer when the learner's partner becomes Declarer? | The learner sits South. North wins the auction, or has more HCP in MiniBridge. The learner is Dummy and makes no decision for 13 tricks. The PRD only offers "declarer and defender" roles (FR-S2, §13.4) | The learner controls the Declaring Side: they play both Hands from Declarer's Seat View. No information gain, because Dummy is exposed anyway — **Resolved 2026-10-18:** learner plays declarer (ADR-0003). |
| Q2 | What is one playing of one Deal called? | PRD uses "hand" for both 13 cards and a played deal ("post-hand review", "show or hide hands"); "game" is a scoring term; "round" means one card from each player | **Playthrough** in the domain; UI copy can say "deal" — **Resolved 2026-10-18:** Playthrough. |
| Q3 | What does a lesson Attempt measure, and do rejected illegal Actions count as wrong Answers? | Module 2 (following suit) asks for a card; the learner tries to revoke. In module 7 the same mistake is incidental | One Attempt per Prompt. A rejected Action counts as a wrong Answer only if the Prompt says so — **Resolved 2026-10-18:** the Prompt decides; default no. |
| Q4 | Can a new Content Version change what counts as correct? | A teacher fixes a wrong Expected Answer after learners have "correct" Attempts on it | No. Changing correctness requires a new Content ID; versions are for wording, commentary and presentation. Earlier Attempts on other versions stay valid — **Resolved 2026-10-18:** no; new Content ID (ADR-0004). |
| Q5 | What exactly is a MiniBridge Contract? | EBU lets Declarer choose a strain and "part-score or game". Is there a level? Can Declarer choose slam? Is there Vulnerability? | Resolve in the one-page MiniBridge rules specification (PRD §13.4); model it as Strain plus Objective (*part-score* or *game*), each mapping to a trick target — **Resolved 2026-10-18:** default accepted. |
| Q6 | Are Decisions in a retry after Review assessed and recorded? | The learner has seen all four Hands, then retries from a Key Moment | Assessed for feedback, but not recorded as Attempts or counted in any progress measure — **Resolved 2026-10-18:** default accepted. |
| Q7 | Does an in-progress Playthrough survive leaving the app? | A teen closes the tab mid-trick on a phone | Yes: resume from the last Position on the same device — **Resolved 2026-10-18:** default accepted. |
| Q8 | Are auction Decisions eligible as Key Moments? | G1 includes bidding, but FR-RV only describes card play | Yes, from the MVP; Decision Quality for a Call comes from the Expected Call and Accepted Alternatives — **Resolved 2026-10-18:** default accepted. |
| Q9 | What does the learner see when the Auction leaves Coverage? | FR-B5 "offers a labelled safe continuation" is undefined | Robots make marked Fallback Actions; the Coach abstains on grading; the learner is offered to finish the auction freely or skip to play — **Resolved 2026-10-18:** default accepted. |
| Q10 | Are forced plays made automatically? | A singleton, or the last trick | Not in Lessons of modules 1–2 (following suit is the point); configurable in Practice — **Resolved 2026-10-18:** default accepted. |
| Q11 | What happens on a Pass-out in Practice? | All four pass | Show the result (Score 0) with a one-line explanation, then offer the next Deal — **Resolved 2026-10-18:** default accepted. |
| Q12 | Do authored lesson Hints have to be VISIBLE? | A Hint saying "West has the king" in an Exercise without an Exposure | Yes. An authored Hint may mention Hidden Cards only after an Exposure of them — **Resolved 2026-10-18:** default accepted. |

## 2. Edge cases already resolved in the glossary

- **Three initial passes.** The fourth Seat may still open; the Auction ends only after four Passes (Pass-out) or three Passes after a Bid.
- **Doubling partner's bid or doubling twice.** Rejected: Double requires the last Bid to be an opponent's and not already doubled.
- **20–20 in MiniBridge.** Redeal derived from the Seed; lesson Deals are rejected by the Validity Checks.
- **Learner miscounts HCP in a lesson.** The answer is a Prompt; the Announcement is computed and true.
- **Revealed voids.** Show-outs are Public Constraints; samplers and the permutation test must keep them fixed.
- **Touching honours.** Equivalent Actions count as one choice, so they never create a Key Moment.
- **A bad play that happens to work.** Assessed *lucky*, not praised (the PRD's CI-3 only covered the opposite case).
- **Tight constraints.** When few Layouts fit, enumerate them all rather than report low confidence.
- **Replaying an old deal after an engine upgrade.** Replay reads the Record (ADR-0002).

## 3. PRD inconsistencies (all applied in PRD v0.2, 2026-10-18)

| PRD location | Issue | Fix |
|---|---|---|
| §7, FR-R1, FR-E1 | "bid" used for any Call | Use **Call**; **Bid** only for level + strain |
| FR-B3, FR-B5, FR-E4, CI-4, FR-H5 | "unsupported", "not covered", "uncertain", "no reliable hint" | One concept, **Abstention**, with three reasons |
| FR-R3 | "The auction ends after three passes"; "double only an opponent's bid" | Use the precise rules in the glossary |
| FR-R2 | "revoke attempts" | Revokes cannot occur; say "rejected plays when able to follow suit" |
| FR-R8, FR-BOT4 | Determinism stated as seed-only | Conditional determinism (ADR-0002) |
| FR-B1 | "One profile ID per session"; "session" is undefined | One Convention Profile per Playthrough |
| FR-S2, §13.4 | Roles listed as declarer and defender; Dummy ignored | The learner plays declarer whenever their side declares (ADR-0003) |
| CI-3 | Only covers "good decision, unlucky layout" | Add the full Decision Assessment (four outcomes) |
| FR-L1, FR-L3, FR-L4, FR-P1 | "deal", "position", "exercise" and "item" used interchangeably | Lesson → Exercise → Step → Prompt; Attempts are per Prompt |
| §7 journey 2, D8 | Duplicate scoring needs Dealer and Vulnerability, which a practice deal never defines | Deal includes Dealer and Vulnerability |
| CI-1 vs FR-H3(a) | Authored hints are not bound by the VISIBLE rule | Lesson Hints mention Hidden Cards only after an Exposure (Q12) |
| §19 | Glossary mixes domain terms with technology (WASM, COOP/COEP) | Point to `GLOSSARY.md` for domain terms |
