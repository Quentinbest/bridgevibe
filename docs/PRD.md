# BridgeVibe: Product Requirements Document

*Product name: BridgeVibe (decision D6, decided 2026-10-18). Earlier drafts used the working name "PlayBridge".*

| Field | Value |
|---|---|
| Status | **Draft v0.2, for owner review** |
| Date | 2026-10-18 (v0.1: 2026-10-17) |
| Prepared by | Claude (Opus 5.5), for the repository owner |
| Approvers | Product owner, engineering lead, bridge teaching advisor (all to be named) |
| Inputs | **[A]** `docs/reports/Bridge Web Game Open-Source Reuse Research.md` · **[B]** `docs/reports/bridge-open-source-assessment-2026-10-16.md` · **[C]** `docs/reports/bridge-reuse-research-report.md` · **[R]** `docs/reports/review-of-bridge-reuse-reports-2026-10-17.md` |

**Conventions**

- **Priority:** **Must**, **Should** or **Could**.
- **Phase:**
  - **V** is the Integration Validation Exercise (§13);
  - **M** is the minimum viable product (MVP);
  - **L** is later.
- **Requirement IDs:** FR (functional), CI (coaching integrity), NFR (non-functional), LR (licensing and rights), VAL (validation acceptance).
- **Terminology:** domain terms (Call, Bid, Playthrough, Seat View, Abstention, Decision Assessment and others) are defined in `GLOSSARY.md`; domain decisions are recorded in `docs/adr/`. v0.2 aligns this document with both.
- **Provisional numbers:** marked *provisional*. Numbers taken from a report cite it (for example, NFR-P2 cites [A]). The rest are starting points set by this draft. The owner confirms validation thresholds in week 0, and product targets are reset once the beta gives a baseline.

---

## 1. Summary

BridgeVibe is a web game that teaches **complete beginners** to play **contract bridge**. It combines:
- short lessons;
- practice deals against computer players;
- plain-language explanations of the rules;
- a coach that gives optional hints during play and a review after each hand.

The research supports five product decisions, which this document adopts (R §5):

1. **Build our own application and reuse engines inside it.** No open-source game is licensed, correct and complete enough to fork.
2. **Use a DDS-family double-dummy solver** for analysing deals after they are played and for checking lesson deals.
3. **Separate what the learner could see from hindsight.** Advice during play may use only information visible to the learner. Review with all four hands visible must be labelled as such.
4. **Engines decide; words explain.** Rules engines and solvers determine legality, scores and correctness. Templates, and optionally a language model, only phrase facts the engines have verified.
5. **The bidding system determines the bidding engine.** One beginner system is chosen and shared by robots, coach and lessons.

**Technology selection is not final.** Before it is, we run a time-boxed **Integration Validation Exercise** (§13), four weeks with a hard stop. At its centre is a **MiniBridge vertical slice**. MiniBridge has no auction, so it tests most of the pipeline without waiting for the bidding-system decision:
- the rules core;
- the solver on target phones;
- non-cheating robots;
- the coach's information boundary;
- post-hand review;
- the lesson player.

What MiniBridge cannot answer runs in parallel tracks or is deferred: bidding explanations, licences, the Bridge-Classroom foundation option, and the blind opening lead (in MiniBridge, the leader sees dummy first).

The exercise ends with a **Technology Selection Decision Record** and an MVP estimate (§14). MiniBridge in the exercise is a validation device, not a commitment to ship MiniBridge (decision D5).

### What the owner approves in week 0

1. Decisions D1 (bidding system), D2 (distribution model) and D3 (backend), or the planning assumptions in §18.
2. The thresholds marked *provisional* in §10.1, §13.7 and CI-3.
3. Staffing: two engineers and two bridge teachers, one of whom can be a part-time second reviewer.
4. The two reference phones used for performance testing.
5. Which optional tracks in §13.5 to run.

---

## 2. Problem

People learning bridge on their own lack three things:

- **Feedback at the moment of error,** and the reason for it: why a card is illegal, why a bid means what it does.
- **Fair feedback.** A correct play can lose to an unlucky lie of the cards. A tool that judges by the actual layout teaches hindsight rather than judgement [A §AI strength vs coaching; B §AI coach; C §5].
- **Practice without three other people,** paced for a beginner.

**What exists today.** No open-source project combines all of the following: a licensed, rule-correct game; a beginner curriculum; and a coach that explains mistakes fairly [A, B, C; R §5]. The parts that are reusable are double-dummy solvers, rule-based bidding engines with machine-readable bid meanings, and some lesson tooling. Strong playing engines and good teaching engines turned out to be different engines [A §AI strength; C §5]. Closed commercial products are out of scope for reuse [A §Known gaps].

---

## 3. Goals and non-goals

### Goals for the MVP

| ID | Goal |
|---|---|
| G1 | A complete beginner can learn to play a full deal of contract bridge, bidding and play, without a human teacher present |
| G2 | Every explanation is factually correct for the system taught, traceable to its source, and fair to what the learner could see |
| G3 | The product works well in mobile and desktop browsers |
| G4 | Every shipped component and content item has a confirmed licence (rights-clean by construction) |
| G5 | Engines sit behind interfaces, so a young or failing dependency can be replaced without changing the user experience |

### Non-goals for the MVP

- Live multiplayer and remote tables. The rules core must not prevent them later (FR-R6).
- Tournaments, ratings and leaderboards.
- Coaching for intermediate or advanced players.
- More than one bidding system.
- Training our own AI models.
- Native mobile apps.
- Teacher and classroom management: assignments, rosters, student tracking.
- A free-form AI chat coach.
- Monetisation features.

---

## 4. Users

| Persona | Description | Primary needs |
|---|---|---|
| **P1: Complete beginner** (primary) | A teenager (13–17) who has never played bridge and may know other card or trick-taking games. Plays mostly in short sessions on a phone, sometimes longer ones on a desktop or school computer | Learn in small steps; never feel lost or judged; understand why; quick wins and visible progress; practise without other people |
| **P2: Course learner** (secondary) | Taking a club or online course and wants practice between classes | Practice deals that match the system taught; rules reference; review of hands |
| **P3: Teaching advisor or content author** (internal) | A qualified bridge teacher who authors and reviews lessons and coach wording | An authoring format, validity checks, a review and sign-off workflow |

The target age group is teenagers aged 13–17 (D9, decided 2026-10-17). Under-13s are out of scope for the MVP, because they would need verified parental consent (COPPA and equivalents). Tone: short, direct and friendly, never childish; mistakes are framed as normal. Adults can still use the product, but design decisions favour teenagers.

---

## 5. Product principles

1. **Teach, don't just grade.** Every judgement comes with the principle behind it.
2. **Never cheat.** Robots and in-play advice use only the information their seat could legitimately know. *Anti-pattern:* GNUBridge's robots solve the real deal [R §8 #18].
3. **Engines decide; words explain.** Legality, scores and correctness come from the rules engine, solver and authored rules, never from free text.
4. **Say "not covered" rather than guess.** A missing rule, a timeout or an unavailable service is shown as such, never turned into "Pass because your hand is weak" [C §5].
5. **Show sources.** Every explanation records where it came from (CI-5).
6. **Be rights-clean by construction.** No component or content item without a confirmed grant (§11).
7. **Keep engines replaceable.** Many candidate engines are months old and maintained by one person [R §6.5]. Wrap each one behind an interface (NFR-M1).

---

## 6. Scope and phases

| Phase | When (relative) | Content | Exit |
|---|---|---|---|
| **0: Decisions** | Week 0 | The owner approvals listed in §1 | Approvals recorded, or planning assumptions accepted |
| **V: Integration Validation Exercise** | Weeks 1–4, hard stop | MiniBridge slice plus parallel tracks (§13) | All Must VAL criteria met or deviations accepted; deliverables in §13.9 |
| **Gate: Technology selection** | Week 5 | Decision Record; MVP estimate (§14) | Owner approval |
| **M: MVP** | Estimated at the gate | Requirements marked M | MVP release criteria (§16) |
| **L: Later** | After MVP | Multiplayer, intermediate coaching, more systems, accounts, optional language-model phrasing, teacher tools | Separate requirements documents |

---

## 7. Key user journeys (MVP)

1. **First session.** Open the app without an account → card basics (suits, ranks, tricks) → following suit → partnership and dummy → first guided deal → short recap.
2. **Practice deal.** The learner sits South, with robot partner and opponents → make calls, with the meaning of every call on demand → play (as declarer whenever their side declares, ADR-0003) → hints on demand → score with explanation. If all four players pass, the score of zero is explained and the next deal offered.
3. **Rules at the moment of error.** An illegal card play or call is refused with a one-line reason ("You must follow suit: you still have a heart") and a link to the rule.
4. **Post-hand review.** Replay the auction and the play trick by trick → up to three key moments (calls or cards) → the cost in tricks of each of the learner's card plays, labelled "all cards visible" → the decision assessment of each key moment (sound, good decision unlucky layout, lucky, mistake) → retry from a key moment.
5. **Return visit.** Progress, and any deal in progress, is restored on the same device → the app suggests the next lesson or practice.

---

## 8. Functional requirements

### 8.1 Game rules and state (FR-R)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-R1 | A single **authoritative rules core** owns the deal, turn order, legal actions, trick completion and scoring. The UI and robots only submit actions; illegal actions are rejected with a reason code and leave the state unchanged | Must | V, M | Rules fixture suite (F1) passes 100% |
| FR-R2 | **Card play legality:** the card must be in the acting hand, suit must be followed when possible, only declarer's controller plays dummy's cards, turn order is enforced, and the last trick and completion are handled. Because failing to follow suit is rejected, revokes cannot occur | Must | V | F1 cases for ownership, rejected plays when able to follow suit, dummy control, final trick |
| FR-R3 | **Auction legality:** each bid must be higher than the last bid; a double is legal only when the last bid is an opponent's and not yet doubled; a redouble only when the last bid is one's own side's, doubled by an opponent, and not yet redoubled (passes may intervene in both cases); once a bid has been made, the auction ends after three consecutive passes (even if the last other call was a double or redouble); with no bid, it ends after four passes (pass-out: no contract, score zero); declarer is the first player of the declaring side to name the final strain. Untrusted input is validated at run time | Must | M | Fixtures include pass-out, three initial passes followed by an opening bid, doubling partner's bid, doubling twice, illegal redouble, fractional and unknown calls (both were defects in bridge-tools [C]) |
| FR-R4 | **MiniBridge setup mode** following the EBU baseline (§13.4) | Must (V) / Could (M) | V | F1 MiniBridge cases: 20–20 redeal, declarer ties, dummy exposed before the contract is chosen |
| FR-R5 | **Scoring:** duplicate contract scoring per WBF Law 77 for the MVP, so every deal includes a dealer and vulnerability; MiniBridge scoring per a named convention for the slice. Inputs are range-checked (tricks are an integer from 0 to 13) | Must | V, M | All 2,940 valid combinations agree with two reference scorers, plus 16 Law 77 examples [C §4]; invalid input rejected |
| FR-R6 | The rules core runs unchanged in the browser and in Node, so a server can later be authoritative for multiplayer | Should | M | The same fixture suite passes in both runtimes |
| FR-R7 | **PBN import and export** of deals, auctions and play, with a strict parser | Should | V, M | Round-trip fixtures; malformed PBN rejected with an error |
| FR-R8 | **Seeded, deterministic dealing; replay from the record.** A seed determines the deal (and any MiniBridge redeal). Every playthrough keeps a record of its accepted actions and engine versions, and replay and review read that record, never a re-run from the seed (ADR-0002) | Must | V | The same seed gives an identical deal; the same seed, learner actions and engine versions, with no fallbacks, give identical robot actions; replay reproduces the record exactly |
| FR-R9 | **Undo and retry** from a position, in lessons and in review. A retry is a new playthrough branching from the earlier one | Should | M | Retry restores the exact state |
| FR-R10 | **Resume.** A playthrough in progress survives closing the app and resumes from its last position on the same device | Should | M | Close mid-trick, reopen, same position |

### 8.2 Lessons (FR-L)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-L1 | A **lesson player** renders authored deals with directives: <br>• show or hide hands; <br>• ask for a card or bid; <br>• accept several correct answers or accepted alternative bids; <br>• staged commentary; <br>• continue on the intended line after a wrong answer; <br>• per prompt, whether a rejected illegal action counts as a wrong answer (default: no, rules feedback only). <br>Bridge-Classroom's lesson directive specification is a design reference [C §Bridge-Classroom] | Must | V (minimal), M | One lesson of 3–5 deals plays end to end (V); full module set (M) |
| FR-L2 | **MVP curriculum** in short modules, teacher-approved. Provisional order: <br>1. cards and tricks; <br>2. following suit; <br>3. partnership and dummy; <br>4. counting sure tricks in no-trumps; <br>5. trumps; <br>6. points and choosing a contract; <br>7. opening bids; <br>8. responses; <br>9. a full deal, bid and played; <br>10. review practice [B §Teaching content, extended for bidding] | Must | M | The teaching advisor signs off each module |
| FR-L3 | **Short prepared exercises** before full random deals [B] | Must | M | Each module starts with fixed positions |
| FR-L4 | Every content item has a **stable ID and a content version**, so corrections do not corrupt progress history [C §Baker]. A new version may change wording and presentation but never what counts as correct; changing an expected answer, deal or script needs a new ID (ADR-0004) | Must | M | Changing an item's version keeps its earlier attempts; the pipeline rejects a version that changes correctness |
| FR-L5 | **Content validity checks:** <br>• 52 unique cards, 13 per hand; <br>• play records consistent with card ownership and following suit; <br>• each directive's expected answer consistent with the lesson prose; <br>• no MiniBridge deal with 20 points per side. <br>Baker-Bridge had defects of both of the last two kinds [R §8 #5] | Must | V, M | The pipeline rejects a lesson where a player plays a card they don't hold |
| FR-L6 | Each lesson **declares the bidding system and agreements it assumes** | Must | M | Lesson metadata matches the active convention profile (FR-B1) |

### 8.3 Rules explanations (FR-E)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-E1 | A **contextual explanation** whenever an action is rejected: a reason code mapped to a plain-language sentence and a rule link | Must | V | Every reason code in F1 has approved text |
| FR-E2 | A **browsable rules reference** and glossary covering MVP rules and scoring basics | Must | M | Teacher sign-off; all glossary terms linked from the UI |
| FR-E3 | An **end-of-hand score breakdown** in words | Must | V (MiniBridge), M | The breakdown matches the scorer's output for all F6 cases |
| FR-E4 | **Meaning of any call on demand:** tap a call to see its meaning in our system, from the authored rule plus teacher-reviewed wording, or an explicit "not covered" abstention | Must | M | 100% of calls in the regression auctions show either a meaning or "not covered" |
| FR-E5 | **Terminology is consistent** within each language (one glossary per locale) | Should | M | Lint check of strings against the glossary |

### 8.4 Bidding (FR-B)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-B1 | **One beginner bidding system** (D1), documented as a versioned convention profile: no-trump range, forcing rules, conventions included and excluded. Robots, coach and lessons all use it | Must | M | One profile version per playthrough, shared by all four seats and the coach, recorded in provenance (CI-5) |
| FR-B2 | The robot partner and opponents **bid with the same profile** | Must | M | No call is made under a different profile |
| FR-B3 | **Every robot call and every grading judgement** traces to a rule ID; otherwise the robot makes a call marked as a fallback and the coach abstains ("not covered"). The engine never silently passes [C §Bridgit, §Rusty; R §6.4] | Must | M | Fault-injection: an uncovered auction produces a marked fallback and a "not covered" abstention, never a fabricated reason |
| FR-B4 | **Bid feedback** compares the learner's call with the rule-based expectation, plus alternatives the teacher has accepted. It never grades by a model's probability alone [C §5] | Must | M | Regression set (VAL-11) |
| FR-B5 | **Coverage limits are visible.** When an auction leaves the covered subset, the app says so; robots make marked fallback calls, later calls are not graded, and the learner chooses to continue the auction ungraded or let it be completed with fallback calls for all seats | Must | M | Uncovered-case fixtures show the notice |

### 8.5 Robots (FR-BOT)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-BOT1 | Robots act **only on information their seat may know** (their seat view, ADR-0001): <br>• their own hand; <br>• dummy, once exposed; <br>• the public auction or announced points; <br>• cards already played. | Must | V | The robot's input objects contain no hidden cards (VAL-05) |
| FR-BOT2 | Play is **legal and plausible**. Strength is secondary for beginners [C §6]. Difficulty is fixed for the MVP | Must | V | Teaching advisor review: no absurd plays in F7 sample deals |
| FR-BOT3 | Decision time is within budget (NFR-P4). On timeout, the robot falls back to a simpler legal policy and logs it | Must | V | The fallback rate is reported in the benchmark |
| FR-BOT4 | Robot play is **deterministic** for a given seed, learner actions and engine versions, when no fallback occurs (ADR-0002) | Should | V | Repeated runs are identical |
| FR-BOT5 | **Pluggable robot policy:** heuristic, sampled double-dummy, or an optional server engine | Should | M | Policies can be swapped without changing the UI |
| FR-BOT6 | **Realistic play.** Robots follow basic, teacher-approved principles (for example: cover an honour with an honour; second hand low; third hand high, where appropriate). This way, finesses and other lesson points work out as they would at a real table | Must (M) / Should (V) | V, M | Teachers review robot play on sample deals from F7 |

### 8.6 Coach: hints during play (FR-H)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-H1 | **On-demand hints,** controlled by the learner, who can turn them off | Must | V | Toggle present; no unsolicited hints outside lessons |
| FR-H2 | Hints use **visible information only** (CI-1) | Must | V | VAL-05 |
| FR-H3 | **Hint tiers:** <br>(a) authored lesson hint, which may mention hidden cards only after the lesson has exposed them; <br>(b) a deterministic principle, such as "second hand low"; <br>(c) a computed estimate from sampling hidden hands, worded with uncertainty | (a) Must (V); (b) Should (M); (c) Should (V) | V, M | At least one tier (c) path in the slice, to exercise sampling and performance |
| FR-H4 | A hint states **why** (principle or facts), not just which card | Must | M | Teacher review |
| FR-H5 | When **no reliable hint** is available, the coach abstains and says why (CI-4) | Must | V | Fault-injection (VAL-06) |

### 8.7 Coach: review after the hand (FR-RV)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-RV1 | **Replay** of the auction and of the play trick by trick, with all four hands, read from the playthrough record | Must | V | Present for every completed playthrough |
| FR-RV2 | The **trick cost of each of the learner's card plays** (including both declaring hands when the learner is declarer; forced plays excluded) under double-dummy analysis, **labelled "with all cards visible"** | Must | V | 100% of double-dummy statements carry the label (VAL-07) |
| FR-RV3 | **Up to three key moments** per playthrough, calls or card plays, selected by the facts layer. Each shows a **decision assessment** that separates the quality of the decision from the outcome (CI-3) | Must | V (curated cases), M | VAL-07, using the F4 cases where the correct play loses |
| FR-RV4 | **Retry from a key moment.** Decisions in a retry get feedback but are never recorded as attempts or progress, because the learner has seen all four hands | Should | M | Restores the exact position; no attempt recorded |
| FR-RV5 | Review works **offline** if the solver runs in the browser; degrades gracefully if the solver is a server service | Must | M | Offline test; message shown when the service is unavailable |

### 8.8 Progress (FR-P)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-P1 | Track lesson completion and each prompt's attempts as correct (right first time), corrected (wrong, then right without being shown) or failed (shown the answer) [C §Bridge-Classroom] | Must | M | State survives a reload |
| FR-P2 | **Skill tags** from a stable taxonomy on each item | Should | M | All MVP items tagged |
| FR-P3 | **No "mastery" claims** until the teacher has validated the formula. Denominators are the declared items of a lesson, not items seen across users (the defect in Bridge-Classroom [R §8 #3]) | Must | M | Formula documented and signed off |
| FR-P4 | **Local-first storage,** with export and import. Account sync comes later | Must (local) / L (sync) | M | Export, wipe and import restores progress |
| FR-P5 | **Suggest the next practice** from attempt history | Could | M | n/a |

### 8.9 Content pipeline (internal) (FR-C)

| ID | Requirement | Priority | Phase | Acceptance |
|---|---|---|---|---|
| FR-C1 | **Offline generation of deals under constraints,** using endplay or equivalent [A, B, C] | Should | V, M | Generator produces deals for a lesson's constraints |
| FR-C2 | **Check each authored deal teaches its point,** using double-dummy and, where relevant, sampled analysis [A §Mapping] | Should | M | The check runs in the content pipeline |
| FR-C3 | **Teacher review workflow,** with sign-off recorded per item | Must | M | No unsigned item ships |
| FR-C4 | **Source and rights recorded** for each content item (LR-5) | Must | M | Rights field required by the pipeline |

### 8.10 Settings (FR-S)

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-S1 | Hints on or off; auto-play of forced plays (practice only; always off in the following-suit lessons); four-colour suits; animation speed; reduced motion; language | Must | M |
| FR-S2 | Learner seat and role mix for practice: always South for the MVP; when the learner's side declares, the learner plays declarer from whichever seat declares (ADR-0003); declarer and defender deals both offered | Should | M |

---

## 9. Coaching integrity requirements (CI)

These requirements are the product's main difference from existing tools. They are taken from points all three reports agree on [A §AI strength; B §AI coach; C §5; R §5].

| ID | Requirement | Verification |
|---|---|---|
| CI-1 | **Information mode label.** Every coach output carries a mode: `VISIBLE` (computed only from one seat view) or `ALL_HANDS` (review only, never while the learner still has a decision to make in that playthrough). Hints are `VISIBLE` only, including authored lesson hints | Type-level enforcement plus VAL-05 |
| CI-2 | **Hindsight label.** `ALL_HANDS` statements are visibly labelled, using teacher-approved wording | VAL-07 |
| CI-3 | **Decision versus outcome.** Each assessed decision combines its quality (acceptable or not, on the visible information) with its outcome (trick cost on the actual layout): <br>• **sound:** acceptable, no cost; <br>• **good decision, unlucky layout:** acceptable, but it cost tricks; <br>• **lucky:** not acceptable, but it cost nothing (never praised); <br>• **mistake:** not acceptable, and it cost tricks. <br>Outcome alone never makes a decision a mistake. For calls, quality comes from the expected call and accepted alternatives, and outcome is not assessed. <br>A card play is *acceptable* when: <br>• the teachers' label for that decision says so; or <br>• where there is no label, its expected tricks over the visible-information samples are within a tolerance of the best alternative (*provisional:* 0.25 tricks over at least 50 samples). <br>The sampled evaluation plays the rest of the hand double-dummy, so it is an approximation. The teachers' labels are the reference | F4 cases with teacher labels, including a finesse that loses (VAL-07) |
| CI-4 | **Abstention.** When the coach cannot answer, it abstains with one of three reasons, never a substantive claim: **not covered** (no rule or content applies), **uncertain** (sample confidence too low; when few layouts fit, enumerating them all counts as full confidence) or **unavailable** (failure or timeout) | Fault-injection (VAL-06) |
| CI-5 | **Provenance.** Each output records its source. <br>• Authored lesson: item and version. <br>• Bidding rule: rule ID and profile version. <br>• Engine: name, version, mode and sample count. <br>• Template: template ID. <br>• Language model, if one is used: model and prompt version. <br>This is visible in a debug panel and stored in a local log | Schema check; every output in F5 has a complete record |
| CI-6 | **Engine probabilities are not correctness.** Model or sample percentages are never shown as "the chance you were right". Grades come from teacher-approved rules and accepted alternatives [C §5] | Copy review; FR-B4 |
| CI-7 | **Language model limits** (only if adopted, D7). Its input is a verified fact bundle. Its output must not add card locations, rules, scores or judgements that are not in the bundle. An automatic check compares output with the bundle and falls back to the template on failure. Turning the feature off loses no correctness [A §AI strength (3); B §AI coach (3)] | Fact-check test set; kill-switch test |
| CI-8 | **Teacher sign-off** on all explanation templates, lesson text and a fixed regression set, re-run on every engine or content change | CI pipeline step; signed records |
| CI-9 | **Hidden-card permutation test** in automated testing. For fixed positions, and separately for each seat's view, sample permutations of the cards that seat cannot see, keeping all public information (including announced points and voids revealed by showing out) fixed. `VISIBLE` outputs and robot actions must not change (with fixed seeds) [B §AI coach; C §7(4)] | Permanent test suite (F3); zero failures |

---

## 10. Non-functional requirements

### 10.1 Performance (NFR-P), *provisional budgets*

The validation exercise measures these on two **reference devices**: a low-end Android phone and a recent iPhone, to be named in week 0. The budgets are then confirmed or revised at the gate.

| ID | Metric | Budget (95th percentile) |
|---|---|---|
| NFR-P1 | Cold start to an interactive first lesson; reference Android; "Fast 4G" throttling; empty cache | ≤ 5 s (desktop broadband ≤ 2.5 s). The solver is lazy-loaded and not on the critical path |
| NFR-P2 | One per-card double-dummy evaluation (`SolveBoard`-type), any position including mid-trick | ≤ 1 s on the reference Android [A §Smallest validation steps] |
| NFR-P3 | Full double-dummy table, run in the background for review | ≤ 3 s, without blocking the UI |
| NFR-P4 | Robot decision, including any sampling | ≤ 1.5 s. A sampled robot must fit within this at its chosen sample count; T2 measures the cost per sample |
| NFR-P5 | Main-thread blocking caused by engine work | No long task over 200 ms; all engines run in Web Workers |
| NFR-P6 | Memory and stability | Peak memory recorded; no tab crash in a 100-deal soak (F7). DDS 3.1's threaded build requests 256 MB initially [R §8 #14], so the budget is set at the gate from measurements |

### 10.2 Compatibility, hosting and offline use

- **NFR-C1:** support the latest two major versions of Chrome, Edge, Firefox and Safari on macOS and iOS, and Chrome on Android.
- **NFR-C2:** if a threaded WebAssembly build is selected, hosting must serve COOP/COEP headers for cross-origin isolation. Static hosts without header control need a service-worker workaround [A, C].
- **NFR-C3 (Should):** after the first load, lessons, solo practice and review work offline (a progressive web app), assuming a browser-only architecture is chosen.

### 10.3 Accessibility (NFR-A)

- Target **WCAG 2.2 AA** for all core journeys.
- Every journey can be completed with a keyboard.
- Screen readers announce cards, tricks, turn and legal options.
- Suits are identifiable without colour: symbols, plus an optional four-colour deck.
- Touch targets are at least 44 × 44 px.
- Reduced-motion setting is respected.

### 10.4 Languages (NFR-I)

- All strings are externalised from day one.
- There is one bridge glossary per language, reviewed by a teacher.
- Launch languages are decision D4: the MVP ships English and Simplified Chinese; Traditional Chinese, Japanese and Spanish follow, each when complete and signed off. Bridge terminology in each language needs teacher review. The multi-language specification is `docs/i18n/i18n-spec.md`.

### 10.5 Privacy and security (NFR-S)

- No account is required for the MVP; there is no personal data collection.
- Analytics are opt-in, need consent and are minimal.
- **Designed for under-18s.** Meet the UK Age Appropriate Design Code (and equivalent rules where the product launches) as the baseline:
  - privacy-protective defaults;
  - no chat, no user-generated content and no contact between users;
  - no advertising and no in-app purchases;
  - no engagement patterns that pressure users to stay, such as streaks that can be lost, countdowns or loss-framed notifications. Personal progress shown without penalty (skills unlocked, deals played this week) is allowed;
  - no location data.
- **Age gate.** Use a neutral age question on first launch. Users under 13 are not supported in the MVP and get a short explanation, not a dead end.
- If a language model is ever used, no personal data is sent to it.
- Hosting region is decision D3.
- Solo play may trust the client. Future multiplayer requires server-authoritative state using the same rules core (FR-R6), and redacted views for each player.

### 10.6 Maintainability and observability (NFR-M)

- **NFR-M1:** stable internal interfaces for each of these, so implementations can be swapped without UI changes:
  - Analysis: solve a table; solve the cards at a position; analyse play. Results carry a mode label.
  - Bidding: call; meaning; coverage. Results carry rule provenance or a "not covered" abstention.
  - Robot policy.
  - Coach facts.
- **NFR-M2:** every third-party engine is pinned to an exact version or commit, with its version stamped in provenance (CI-5).
- **NFR-M3:** error reporting needs consent and records engine versions.
- **NFR-M4:** the fixture suites (F1–F7) run in automated testing.

---

## 11. Licensing and content-rights requirements (LR)

**Planning assumption PA-3:** design for the strictest plausible distribution model, which is commercial and closed source, so that every option stays open [B §Confirmed scope].

| ID | Requirement |
|---|---|
| LR-1 | Every shipped artefact (code, WebAssembly, weights, fonts, images, lesson text) appears in a **bill of materials** with its licence, version or commit, and the notices it requires. An automated licence check runs on each build |
| LR-2 | **Nothing ships without an explicit licence grant.** Excluded on this basis: Nickel Bridge, bridge-game-coach, maxgiraldo/playbridge, tomron/bridge-kids and rajnesh/bridge-bidding-system-js [R §8 #24; C §3] |
| LR-3 | **EPBot and BBA material.** Without written terms from their owner, the shipped product contains none of the following: <br>(a) **Their code or binaries,** including BEN's bundled BBA, BGA and SuitC binaries [R §8 #22]. <br>(b) **Models trained on their output,** such as pons's `american_bba_*` weights, whose training teacher is recorded as "bba" [R §8 #6]. These are compiled into the pons library with `include_bytes!` whatever the entry point, so their absence must be confirmed in the built artefact. <br>(c) **Run-time calls to them,** such as Bridge-Classroom's BBA-based grading [R §8 #2], or BEN's default configuration, which consults BBA. <br>Content whose *selection* used EPBot is a rights question under LR-5, decided case by case. For example, Baker-Bridge re-rolls opponents' hands until EPBot would pass with them. Such deals can be regenerated without EPBot if needed |
| LR-4 | **No GPL code in the browser bundle** until the distribution model (D2) is decided and is compatible with it. A GPL service (such as BEN) needs its own review, focused on bundled binaries and data [R §6.5] |
| LR-5 | **Lesson content is original, or covered by written rights.** Downloadable material such as EBED teaching hands is not permission to redistribute it [B]. Before any Baker-Bridge material is used, confirm the scope of the original site's permission [C §Baker-Bridge] |
| LR-6 | Code or text may be **copied only from licensed sources**. Unlicensed projects may be studied for user-experience ideas only |
| LR-7 | **Licence-file reading.** Licences are read from the actual files, not GitHub's automatic detector, which mislabelled redeal, BridgeZ and others [R §8 #10, #30] |

---

## 12. Candidate technology (not final)

### 12.1 Responsibilities that stay separable

These are responsibilities, not mandated services [C §6].

```
 Browser                                                      Optional server (only if a Must
 ┌──────────────────────────────────────────────────────┐      requirement fails without it)
 │ UI: lesson player, table, review, rules reference    │     ┌──────────────────────────────┐
 │        │ actions                   ▲ text + labels    │     │ Native DDS analysis          │
 │        ▼                           │                  │     │ Robot service (e.g. BEN)     │
 │ Rules core (authoritative state) ── Coach facts layer │◄───►│ Bidding service (Python/.NET)│
 │        │                            │  ▲ templates    │     └──────────────────────────────┘
 │        ▼ visible views only         │  │ (LLM: later) │
 │ Workers: robot policy · bidding engine (WASM) ·       │
 │          double-dummy solver (WASM)                   │
 │ Local store: progress, settings, provenance log       │
 └──────────────────────────────────────────────────────┘
 Offline: content pipeline (deal generation, validity checks, teacher sign-off)
```

### 12.2 Candidate register entering validation

| Responsibility | Candidates | Evidence and caveats | Decided at the gate by |
|---|---|---|---|
| **Double-dummy analysis** | **bridge-dds** 1.4.0 (DDS 2.9 compiled to WebAssembly, Apache-2.0) · **macroxue/bridge-solver** (MIT or Apache-2.0, 72 KB WebAssembly) · **DDS 3.1** official WebAssembly build (Apache-2.0; release v3.1.0) · pons-dds (Apache-2.0, young) | bridge-dds and macroxue each matched native DDS on 100 of 100 deals, on a desktop [A]. bridge-dds needs a bundler (packaging defect [R §8 #15]) and has one maintainer. DDS 3.1's threaded build needs cross-origin isolation and 256 MB. **Nothing has been measured on phones** | T2, VAL-03, VAL-04 |
| **Rules and state core** | **Our own TypeScript core** (planning default) · RalphLipe/ts-contractbridge core (MIT applies to `packages/ts-contractbridge` only; not on npm) | ts-contractbridge's scoring agrees with two other libraries on all 2,940 combinations, but it accepts 14 tricks, and its PBN play recorder cannot check card ownership [C] | T1, VAL-01, VAL-02 |
| **Lesson foundation** | **Our own lesson player** · **Bridge-Classroom** (Unlicense; Vue 3 front end and Rust back end) | Classroom grades against BBA, falls back to BBA without telling the user, and computes the mastery denominator incorrectly. Only 9 of its 70 test files were run [R §6.4, §8 #1–4] | T4 |
| **Lesson content** | Original lessons · Baker-Bridge (Unlicense code; third-party content permission scope unverified; opponents' hands filtered with EPBot; known defects) · endplay (MIT, offline) | [C §Baker-Bridge; R §8 #5] | T3, LR-3, LR-5 |
| **Bidding and explanations** (MVP; system decided in D1) | **rusty-bidding-bot** (MIT or Apache-2.0, WebAssembly, created 2026-09-21) · pons `american_instinct()` (Apache-2.0; **dropped, D11**: its book was tuned against BBA, so a build without the BBA-taught weights does not settle LR-3) · saycbridge (BSD-3, Python and Z3 server, SAYC) · Bridgit (MIT, C#, 2/1; its history explanation is not implemented) | rusty-bidding-bot reports uncovered auctions explicitly. Its bundled stock convention cards need their origin checked. saycbridge passes 1,325 of 1,483 booklet cases. Bridgit passes by default when no rule applies [A, C; R] | T5, VAL-11 |
| **Robot policy** | **Our own visible-information policy:** rule-based in the slice; sampled double-dummy added in the MVP only if T2 shows it fits NFR-P4 · BEN as a server (GPL-3.0; deferred) | BEN needs an auction, so it does not fit MiniBridge [B §Recommended route]. Its bundled binaries are a licence blocker (LR-3) | T1, VAL-04, VAL-05 |

### 12.3 Excluded, with reasons

These may still be studied for user-experience ideas only (LR-6).

| Project | Reason |
|---|---|
| Nickel Bridge, bridge-game-coach, maxgiraldo/playbridge, tomron/bridge-kids, rajnesh/bridge-bidding-system-js | No licence for their own code |
| EPBot / BBA | No licence; reportedly free for non-commercial use only |
| kduffie/bridge-engine | Scores doubled and redoubled contracts wrongly (2♥ doubled made exactly: 110 instead of 470) [R §8 #20] |
| GNUBridge | Robots solve the real deal; scoring tests expect wrong values [R §8 #18–19] |
| @bridge-tools/dd 0.2.2 | Returned wrong results in A's test script. Re-test only if a need appears |
| redouble, LibreBridge, eBridge, PyBridge, Free Bridge | Old, incomplete or desktop-only |

---

## 13. Integration Validation Exercise (MiniBridge slice)

### 13.1 Purpose

Before selecting technology, prove that the candidate components work together on target devices. The exercise must answer these questions with measurements:
- Is the rules core correct?
- Is the solver fast enough on phones?
- Can robots and hints avoid hidden information?
- Is the post-hand review labelled honestly?
- Does the lesson player work?
- Is each component licence-clean?

It must also produce the evidence needed to choose between adapting Bridge-Classroom and assembling components, and to choose a bidding engine.

### 13.2 Why MiniBridge, and what it cannot show

| MiniBridge **validates** | Why it carries over to full bridge |
|---|---|
| Rules core: dealing, turn order, following suit, dummy control, tricks, completion | The card-play rules are the same as in bridge |
| Solver integration in workers on target phones | Review and sampled robots use the same solves |
| Information discipline under public constraints | Announced points are public constraints on the hidden hands. The slice proves the plumbing bridge also needs: a separate view for each seat, constrained sampling, and the permutation test. Auction inferences are looser (ranges and shapes that depend on the system), so the sampler will need extending after the gate |
| Robots that don't cheat: contract choice, declarer and defender play | The same visible-information boundary |
| Post-hand review: labelling, and decision versus outcome | The same component |
| Lesson player and content checks for card-play lessons | Same format |
| Rule explanations at the moment of error | Same component |

**MiniBridge cannot validate** the following. Each is covered by another track or deferred:
- the bidding engine, bid explanations and consistency with conventions (T5);
- sampling from an auction (after the gate);
- BEN-style robots that need an auction (deferred);
- full duplicate scoring in a game flow (the scorer itself is tested by F6);
- **the blind opening lead.** In MiniBridge, dummy is face up before the lead (EBU steps 5–7); in bridge, the lead comes first. pons's documentation identifies the blind lead as the main gap between real and double-dummy results at part-score level. It is deferred to the first full-bridge milestone;
- **the full difficulty of the information boundary.** All four point counts are public, so less is hidden than in bridge. Passing the permutation test here is necessary but not sufficient, so the test is re-run on full bridge in the MVP.

### 13.3 Scope of the slice

**In scope:**
- an internal web build at a private URL;
- one learner as South, with three robots;
- the MiniBridge setup per §13.4;
- one authored card-play lesson of 3–5 fixed deals;
- hint tiers (a) and (c);
- post-hand review;
- a provenance debug panel;
- the fixture suites;
- a device benchmark harness.

**Out of scope:**
- visual design polish;
- accounts and persistence beyond the session;
- bidding;
- languages other than English (strings still externalised);
- any language model;
- multiplayer;
- analytics;
- public deployment.

**Code status:** the slice is not a release. The rules core, the engine interfaces and the fixture suites are written to production standard, because they are expected to survive whichever path the gate selects. UI code may be thrown away.

### 13.4 MiniBridge rules baseline (EBU)

These rules follow the EBU's "11 easy steps to play MiniBridge", confirmed in R §8 #27. Before week 1, record them in a one-page rules specification with the exact EBU text for each step.

1. Deal 13 cards to each player, from a seed.
2. Each player announces their high-card points (A = 4, K = 3, Q = 2, J = 1) in turn from the dealer. In a lesson, the learner may be asked to count.
3. If each partnership has 20 points, redeal.
4. The partnership with more points declares. Within it, the player with more points is declarer; on a tie, the player who announced first.
5. Dummy is laid face up **before** the contract is chosen.
6. Declarer chooses the strain (no-trumps or a suit) and an objective, part-score or game, according to the scoring convention. The rules specification fixes each objective's trick target, whether slam is available, and whether vulnerability applies.
7. The player on declarer's left leads. When the learner's side declares, the learner plays declarer (ADR-0003). Thirteen tricks are played under normal rules.
8. Score using a **named** MiniBridge convention: the EBU's "How to score MiniBridge", confirmed in the specification. Do not use the duplicate scorer unmodified [B].

Deal selection must give the learner both declarer and defender roles.

A robot declarer chooses the contract with the simple rule a beginner is taught, based on combined points and trump fit. The rule is written into the rules specification and approved by the teachers. It is cheap, and it shows the learner good habits.

Sampling is exercised only where it adds evidence: one hint path (FR-H3 tier c) and the after-hand evaluation of key moments, which can run in the background. On report A's desktop figures (a median of 121 ms per full table), 20 sampled tables already take about 2.4 s before any phone slowdown. That is why sampling stays off the robots' critical path.

### 13.5 Tracks and time box (4 weeks, hard stop)

| Track | Status | Content | When | Effort (estimate) |
|---|---|---|---|---|
| **T1: MiniBridge slice** | Required | Rules core with MiniBridge setup and scorer; fixture suites F1 and F6; solver worker adapter and F2 harness; rule-based robots; minimal lesson player; table UI; review with labels and key moments; an authored and a sampled hint path; provenance panel | Weeks 1–4 | About 23 engineer-days (breakdown below) |
| **T2: Solver benchmark on devices** | Required | bridge-dds, macroxue and DDS 3.1 (single-threaded, plus threaded with cross-origin isolation); pons-dds is optional. Run F2 and F7 on both reference phones, and measure the cost per sample of sampled evaluation | Weeks 1–2 | 2 days |
| **T3: Licence bill of materials** | Required | Apply LR-1 to LR-7 to every slice dependency and every gate candidate. No pons `american_instinct()` build is needed: pons was dropped as a bidding candidate (D11) | Week 1, plus waiting for replies | 1 day |
| **T4: Bridge-Classroom fit check** | Required | Answer for Bridge-Classroom the question the slice answers for the component path. At the cited commit, with BBA removed: can one lesson and one practice deal run offline on the reference phones? What would it take to add MiniBridge setup and our coach labels? This includes the full unit suite and a production build with the real Rusty WebAssembly | Weeks 2–3 | 4–5 days |
| **T5: Bidding explanation comparison** (not MiniBridge) | Required | Candidates for the D1 system, run on 30 auctions reviewed by both teachers. They must include a valid alternative bid, a forcing auction and a case no rule covers. If D1 is not decided by the end of week 1, use the beginner subset common to SAYC and 2/1 | Weeks 2–4 | 3 days, plus 1 day per teacher |
| **T6: Fair-feedback study** | Optional | On F4: compare the double-dummy cost with the sampled (single-dummy) cost of the learner's key decisions, and count how often double-dummy alone would blame a correct play [A §Smallest validation steps] | Weeks 3–4 | 2 days |
| **T7a: Teacher grading** | Required | Both teachers label the F4 decision points (due before week 2) and grade F5. Under D10, two AI annotators may label F4 instead | Weeks 1–4 | 1–2 days per teacher |
| **T7b: Learner observation** | Optional | Three to five complete beginners each try the lesson and one MiniBridge deal | Week 4 | 1 day |
| **T8: Landscape re-scan** | Required | Re-run the union of the three reports' searches and record why each candidate is excluded [R §9.3] | Week 4 | ½ day |

**T1 breakdown** (engineer-days, *estimate*), so each line can be challenged:
- rules core, MiniBridge setup and scorer: 4;
- fixture suites F1 and F6: 2;
- solver worker adapter and F2 harness: 3;
- rule-based robots (FR-BOT1 to FR-BOT3 and FR-BOT6): 2;
- minimal lesson player: 3;
- table UI: 3;
- review with labels and key moments: 3;
- hint paths, one authored and one sampled: 2;
- provenance panel: 1.

**Staffing:** two engineers and two bridge teachers, one of whom can be a part-time second reviewer. The required tracks total about 34 engineer-days (*estimate*), against 40 available in four weeks. Optional tracks run only if the required ones are on schedule at the end of week 2. With one engineer, the hard stop moves to week 7, or T4 and T5 move to the gate. A slip beyond the hard stop needs owner approval; the default is to stop and decide with the evidence available.

### 13.6 Fixtures

| ID | Fixture |
|---|---|
| F1 | At least 40 rules cases: <br>• MiniBridge: 20–20 redeal, ties for declarer, dummy shown before the contract is chosen, choosing the contract; <br>• play: following suit, rejected plays when able to follow suit, playing a card not held, dummy control, turn order, trumps winning tricks, the last trick, duplicate-card input, malformed input |
| F2 | 100 seeded deals (endplay `generate_deals(produce=100, seed=42)` reproduces A's set), plus **200 mid-play positions** from tricks 2 to 12, including positions in the middle of a trick. References: native DDS via endplay, and macroxue as an independent solver |
| F3 | 20 positions × 10 permutations of the hidden cards, all consistent with the public information (CI-9) |
| F4 | 30 beginner deals with curated decision points, including **at least 5** where the correct play loses on the actual layout (for example, a finesse). Each decision point carries the labels of two independent graders (acceptable or not), recorded before week 2: the teachers, or two AI annotators under D10. Each label records its source |
| F5 | At least 20 coach outputs (hints and review moments), plus the lesson, for teacher grading |
| F6 | MiniBridge scoring cases; all 2,940 duplicate contract-score combinations against two reference scorers; 16 Law 77 examples |
| F7 | A 100-deal automatic soak on each reference phone |

### 13.7 Acceptance criteria

Criteria marked "Blocking" must pass, or the owner must accept a written deviation. Thresholds marked *provisional* are approved by the owner in week 0.

| ID | Criterion | Threshold | Blocking |
|---|---|---|---|
| VAL-01 | Rules correctness (F1) | 100% pass | Yes |
| VAL-02 | Scoring (F6) | 0 mismatches; invalid input rejected | Yes |
| VAL-03 | Solver correctness (F2) for each candidate binding | 0 mismatches against both references; any mismatch is investigated to its cause | Yes, for that candidate |
| VAL-04 | Device performance (T2, F7) | NFR-P1 to P6 budgets met on both reference phones by at least one solver candidate | Yes (decides browser versus server) |
| VAL-05 | Information boundary (F3, plus inspection of requests and responses) | 0 hidden cards in hint or robot inputs; 0 permutation failures | Yes |
| VAL-06 | Abstention (fault injection: solver timeout or failure, an uncovered situation) | 0 silent fallbacks; every case shows an abstention ("not covered", "uncertain" or "unavailable") | Yes |
| VAL-07 | Review labelling (F4) | 100% of double-dummy statements labelled; 0 correct plays marked as mistakes in the curated cases. "Correct" is per the F4 labels; under D10 these may be AI labels, and the report names the source | Yes |
| VAL-08 | Teacher grading (F5) | 0 critical factual errors; at least 90% rated clear (*provisional*). Disagreements between the two teachers are resolved before scoring | Yes |
| VAL-09 | Learner observation (T7b, optional) | Beginners finish the lesson and one deal, and can state the lesson's point afterwards [B §Recommended route and the next validation gate] | No (findings feed the MVP) |
| VAL-10 | Licence bill of materials (T3) | Every slice and gate-candidate artefact has a confirmed licence; 0 artefacts derived from EPBot or BBA | Yes |
| VAL-11 | Bidding comparison (T5) | Every call traces to a rule, or is a marked fallback with a "not covered" abstention; teacher accuracy at least 90% (*provisional*) for at least one candidate | Yes, for the bidding decision |
| VAL-12 | Fair-feedback study (T6) | Rate at which double-dummy wrongly blames correct plays is measured and reported | No (sizes the sampling work) |

### 13.8 Stop rules

Stop evaluating a candidate when it has a blocking licence, rules or information-boundary defect with no small remedy [C §7]. Do not extend benchmarks just to fill a comparison table.

### 13.9 Deliverables

1. The slice build (internal URL) and its source.
2. The F1–F7 fixture suites as automated tests that stay in the codebase.
3. A device benchmark report.
4. The licence bill of materials.
5. The Bridge-Classroom fit report.
6. The bidding comparison report.
7. The fair-feedback study (if T6 runs).
8. The teachers' review notes and F4 labels.
9. The learner observation notes (if T7b runs).
10. **One updated candidate register**, replacing the three divergent tables in the reports [R §9.4].
11. **The Technology Selection Decision Record.**
12. **An MVP estimate** for the chosen path, plus a rough estimate for the rejected alternative. Both include content production (lessons, deals and teacher time), which is likely the largest MVP cost.

---

## 14. Technology selection gate

| Decision | Options | Selection rule |
|---|---|---|
| **Solver binding and location** | bridge-dds · macroxue · DDS 3.1 WebAssembly · pons-dds · native DDS on a server | Choose the smallest candidate that passes VAL-03 and VAL-04 on both reference phones. If none passes VAL-04: run analysis on a server, keep legality in the browser, and re-decide NFR-C3 (offline) |
| **Rules core** | Our own TypeScript core · extract the ts-contractbridge core | Our own core, unless extracting passes F1 and F6 with less effort. Either way, the core used is the single authority |
| **Foundation** | Adapt Bridge-Classroom · assemble components | Bridge-Classroom if all three hold: <br>• T4 passes (full suite green, offline build on the reference phones, BBA removed); <br>• its MVP estimate is at least 25% lower (*provisional* margin, covering the risk of adopting a young external codebase); <br>• its Vue and Rust stack is acceptable. <br>Otherwise assemble components. The fixture suites and solver adapter from T1 carry over to either path |
| **Bidding engine** | rusty-bidding-bot · saycbridge · Bridgit · author our own (pons dropped, D11) | Highest teacher accuracy with complete provenance and explicit "not covered" abstentions. Ties go to licence simplicity and browser fit. If none passes VAL-11, author our own rule tables, using rusty-bidding-bot's `.bid` format or pons's rule language as design references |
| **Robot policy (MVP)** | Heuristics · sampled double-dummy in the browser · BEN server | The simplest policy that meets FR-BOT1 to FR-BOT3 on the reference phones. BEN only if LR-3 and LR-4 are cleared and a backend is accepted |
| **Backend** | None · optional services | None, unless a Must requirement fails without one |
| **Language-model phrasing** | No · yes, under CI-7 | Not in the MVP unless templates fail the teacher's clarity review and CI-7 can be implemented |

**Decided by** the product owner, with the engineering lead and the teaching advisor. The decision is recorded as an architecture decision record under `docs/`.

---

## 15. Success metrics

These targets are placeholders set by this draft, not derived from data. They are reset once a closed beta gives a baseline.

| Metric | Definition | Starting target (placeholder) |
|---|---|---|
| **Activation** (north star) | Share of new learners who complete their first guided full deal in their first session | ≥ 60% in beta |
| Curriculum progress | Share of learners who start module 1 and finish module 3 | Baseline in beta |
| **Learning gain** | Pre/post and delayed transfer quiz on unseen examples, designed by the teacher | A meaningful gain in the pilot; target set after baseline |
| **Explanation accuracy** | Teacher audit of a sample of production explanations | 0 critical errors; ≥ 95% accurate |
| **Coach integrity** | Automated: hidden-information leaks and silent fallbacks | 0 and 0, release-blocking |
| Hint helpfulness | Learner rates the hint "helpful" (one-tap prompt) | ≥ 70% |
| Coverage | Share of practice auctions that reach "not covered" | Baseline; tracked so lesson and rule coverage can be extended |
| Return rate | Day-7 return, among consenting users | Baseline in beta |
| Performance | Field 95th percentiles against NFR-P | Within budget |

---

## 16. MVP release criteria

1. All Must requirements in FR, CI, NFR and LR marked M are implemented and accepted.
2. Coaching integrity suites (CI-9, VAL-05 to VAL-07 equivalents) pass, with zero failures, in automated testing.
3. The teacher has signed off every shipped lesson, template and explanation, and the regression set passes (CI-8).
4. The licence bill of materials is clean (LR-1 to LR-7) and recorded for the release.
5. Performance budgets are met on the reference devices.
6. A WCAG 2.2 AA audit of the core journeys finds no critical issues.
7. A pilot with 10–20 complete beginners (*provisional*) shows no major teaching failures, with misconceptions recorded and addressed.

---

## 17. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| RK-1 | The solver is too slow or too memory-hungry on low-end phones | Medium | High | Several solver candidates, including the 72 KB macroxue build; single-threaded builds; a server fallback (§14) |
| RK-2 | The coach teaches hindsight or leaks hidden cards | Medium | High | CI-1 to CI-4 and CI-9 as permanent tests; VAL-05 to VAL-07; teacher review |
| RK-3 | Bid explanations are inaccurate or have gaps in coverage | High | High | Narrow beginner subset; explicit "not covered" abstentions; teacher regression set; author our own rules as a fallback |
| RK-4 | A young dependency with one maintainer stalls or changes its API | High | Medium | Interfaces (NFR-M1); pin and vendor dependencies; the re-scan in T8 |
| RK-5 | Licence contamination through EPBot-derived assets or unlicensed code | Medium | High | LR-1 to LR-3 and LR-6; inspect built artefacts |
| RK-6 | Lesson content rights are unclear | Medium | Medium | Original content by default (LR-5) |
| RK-7 | Results from MiniBridge do not carry over to full bridge | Medium | Medium | §13.2 sets the limits; bidding has its own track (T5); the blind opening lead, auction-based sampling and the full-bridge permutation test are planned for the first MVP milestone |
| RK-8 | Learning value is unproven | Medium | High | Learner observation (VAL-09); pilot before release (§16) |
| RK-9 | Scope creep into multiplayer, advanced coaching or a chat coach | Medium | Medium | Non-goals (§3); separate requirements documents |
| RK-10 | Language-model claims that are not true (if adopted) | Medium | High | CI-7: input limited to facts, output checked, kill switch |
| RK-11 | Name collision: `maxgiraldo/playbridge` is a bridge and MiniBridge project with the same name as our former working name [R §9.4] | Low (renamed to BridgeVibe, D6) | Low | Decision D6 before any public release |
| RK-12 | Teaching judgement rests on too few people | Medium | High | Two teachers grade every review set, with disagreements resolved and recorded; both recruited in week 0 |
| RK-13 | Content production is underestimated | Medium | High | The MVP estimate at the gate includes lessons, deals and teacher time (§13.9) |

---

## 18. Open decisions and planning assumptions

| ID | Decision | Needed by | Planning assumption until decided |
|---|---|---|---|
| D1 | **Beginner bidding system:** SAYC, 2/1, Acol or custom | **Decided 2026-10-25 (delegated to Claude by the owner):** a SAYC-based beginner profile. Phase V and T5 use the beginner subset common to SAYC and 2/1 (15–17 1NT, five-card majors, Stayman, Jacoby transfers, weak twos, strong 2♣, negative doubles); the MVP convention profile (FR-B1) extends it within SAYC | All four candidate engines (rusty-bidding-bot, pons `american_instinct()`, saycbridge, Bridgit) are SAYC or 2/1, so Acol would leave T5 without a candidate; the T5 auction draft already uses this subset. Teachers confirm the profile's contents (CI-8) |
| D2 | **Distribution model:** commercial or not; closed or open source; hosted only or binaries shipped | The gate (week 5) | PA-3: strictest model (commercial, closed source) |
| D3 | **Backend acceptable, and hosting region** | The gate | PA-1: browser-first; add a server only if a Must requirement fails without one [A] |
| D4 | **Launch languages** | **Decided 2026-10-31 (owner):** the MVP ships English (`en`) and Simplified Chinese (`zh-Hans`) | Traditional Chinese (Taiwan terminology), Japanese and Spanish follow after the MVP. Each ships only when its catalogue, lesson text and Locale Glossary are complete and signed off by a teacher who knows bridge in that language (`docs/i18n/i18n-spec.md`, U-19). Phase V stays English-only |
| D5 | **Does MiniBridge ship as a curriculum module** (for example, module 6, "points and choosing a contract")? | After the exercise | No commitment; FR-R4 is Could for the MVP |
| D6 | **Product name** | **Decided 2026-10-18:** BridgeVibe | Replaces the working name "PlayBridge", which collided with `maxgiraldo/playbridge` (RK-11). A trademark check is still needed before public launch |
| D7 | **Language-model phrasing in the MVP** | The gate | No; templates only |
| D8 | **Practice scoring variant:** duplicate score per hand, Chicago or rubber | Before MVP design | Duplicate score per hand (FR-R5) |
| D9 | **Target age group and tone** | **Decided 2026-10-17:** teenagers aged 13–17 | See §4 and §10.5. Coach wording in the teenage register (for example, "Good call, bad luck" for CI-3, "X-ray view" for CI-2) still needs teacher sign-off (CI-8) |
| D10 | **Who labels F4** | **Decided 2026-10-25 (owner):** two independent AI annotators, A and B, may label the F4 decision points in place of the teachers (DEP-05, T7a) | Each label records its source (`ai` or `teacher`). Teachers' labels replace the AI labels when they are provided. While F4 carries AI labels, VAL-07 measures the coach against the AI annotators, not against teachers; reports say so. Disagreements between the two may be resolved by a third AI adjudicator (owner, 2026-10-25); each resolution records that source, and the teachers review the adjudicated options and may overrule them. Lesson labels and teacher sign-off of wording (CI-8) are unchanged |
| D11 | **pons as a bidding candidate** | **Decided 2026-10-30 (owner):** pons `american_instinct()` is dropped as a bidding candidate for the technology selection gate (#34) | Removing the `american_bba_*` weights would not settle LR-3: upstream records that its deterministic floor was modelled on a reverse-engineering of EPBot and that many defaults were tuned against BBA. T3 produces no pons build; T5 (VAL-11) chooses among rusty-bidding-bot, saycbridge and Bridgit. pons-dds, the separate double-dummy solver, is unaffected |

### Planning assumptions

| ID | Assumption | Basis |
|---|---|---|
| PA-1 | Browser-first; add a server only if a Must requirement fails without one | [A] §Recommended reuse approach |
| PA-2 | Solo play against robots; no live multiplayer in the MVP | [B] §Confirmed scope |
| PA-3 | The strictest plausible distribution model (commercial, closed source), so every option stays open | [B] §Confirmed scope; §11 |
| PA-4 | The product target is full contract bridge, bidding and play. MiniBridge is used for the validation exercise; whether it also ships is decision D5 | [A], [C], and the owner's instruction for this PRD |

---

## 19. Glossary

Domain terms are defined in `GLOSSARY.md`, which takes precedence over this table. The table below keeps the technical and analysis terms used in this document.

| Term | Meaning |
|---|---|
| **Double-dummy (DD)** | Analysis with all four hands visible and perfect play assumed. Exact, but it is hindsight |
| **Single-dummy (SD) / sampled analysis** | Estimates made over many possible layouts of the hidden cards, consistent with what the player knows. Fair, but approximate |
| **DDS** | The reference open-source double-dummy solver (Apache-2.0) |
| **MiniBridge** | A beginner form of bridge with no bidding: points are announced, dummy is exposed, and declarer chooses the contract (EBU baseline) |
| **HCP** | High-card points: A = 4, K = 3, Q = 2, J = 1 |
| **PBN** | Portable Bridge Notation, an interchange format for deals, auctions and play |
| **SAYC / 2/1 / Acol** | Bidding systems. SAYC and 2/1 are American; Acol is British |
| **Convention profile** | A versioned record of the bidding agreements in use |
| **Provenance** | A record of which source, rule, engine and information mode produced an output |
| **WebAssembly (WASM)** | A compiled format for running native engines in the browser |
| **COOP/COEP** | HTTP headers that enable cross-origin isolation, which multi-threaded WebAssembly requires |

---

## Appendix A: Traceability of key product decisions

| PRD decision | Basis |
|---|---|
| Build our own app; don't fork a complete game | A §Recommended reuse approach; B §Decision; C §1; R §5 (1) |
| DDS-family solver for analysis; several bindings compared | A §Detailed shortlist 1–3; B §What the implementation inspection changes (4); C §Solvers 1, 5; R §8 #13–15 |
| Information modes, hindsight labelling, decision versus outcome (CI-1 to CI-3) | A §AI strength vs coaching (1); B §The AI coach needs two information modes; C §5; R §5 (3) |
| Abstention and no silent Pass (CI-4, FR-B3) | C §5, §Bridgit, §rusty-bidding-bot; R §8 #2, #21 |
| Hidden-card permutation test (CI-9) | B §The AI coach needs two information modes; C §7 (4); R §6.3, §9.3 |
| Language model phrases, never judges (CI-7) | A §AI strength vs coaching (3); B §The AI coach needs two information modes (3); C §5 |
| Exclude EPBot-derived assets (LR-3) | C §Pons, §BEN, §Path-level licence checklist; R §6.1, §8 #6, #22 |
| MiniBridge rules baseline (§13.4) | B §Teaching content; R §8 #26–27 |
| Mid-trick positions and device budgets (F2, NFR-P2) | A §Smallest validation steps; R §6.2 A3 |
| Bridge-Classroom fit check (T4) and foundation rule (§14) | C §1, §Bridge-Classroom; R §6.4, §9.3 |
| Bidding comparison with teacher review (T5) | A §Smallest validation steps; C §7 (5); R §9.3 |
| Robot strength is secondary for beginners | C §6 (Conditions that change the recommendation); A §AI strength vs coaching |
| Single candidate register; landscape re-scan | R §6.5, §9.3, §9.4 |
