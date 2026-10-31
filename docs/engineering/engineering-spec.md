# BridgeVibe: Engineering Specification

| Field | Value |
|---|---|
| Status | **Draft v0.2, for engineering lead, owner and teacher review** |
| Date | 2026-10-18 (v0.2 adds the edge-case and failure-mode review, §7.4) |
| Derived from | `docs/PRD.md` v0.2 · `GLOSSARY.md` · `docs/adr/0001`–`0004` · `docs/domain/open-questions.md` · `docs/ux/ux-spec.md` v0.1 |
| Scope | MVP (phase **M**), with the Integration Validation Exercise (phase **V**) marked. Phase V parts are implementation-ready. Phase M parts are ready except where marked **Gate** |

**Conventions**

- **Phase** follows the PRD: **V** is the validation exercise (MiniBridge slice), **M** is the MVP. "V, M" means it is built in V and kept for M.
- **Decision status** on every implementation decision:
  - **Confirmed:** stated by the PRD, an ADR or the glossary. Cited.
  - **Proposed:** made by this specification. The engineering lead approves it, or replaces it before the work starts.
  - **Gate:** decided at the technology selection gate (PRD §14). This specification gives only the constraints any option must meet.
- **Terms** are the glossary's. Data entities are written in `CodeStyle`, as names only; no programming language is implied.
- **IDs:** stories are `US-nn` and acceptance criteria `US-nn.k`. Unresolved decisions are `U-nn` (§7.3), assumptions `A-nn` and dependencies `DEP-nn`.
- **Repository state:** there is no application code, test suite or build yet. "Existing patterns" means the domain language, the ADRs and the UX specification. Every test seam below is new; the fixture suites F1–F7 (PRD §13.6) are the permanent ones.

---

## 1. Problem Statement

A teenager who wants to learn contract bridge alone has no tool that teaches the rules at the moment of a mistake, gives feedback that is fair to what they could see, and lets them practise without three other people (PRD §2). Existing open-source games are unlicensed, wrong in places, or judge plays with hindsight. A correct finesse that loses gets marked as a mistake, and that teaches luck instead of judgement.

There is a second, engineering problem. The candidate engines (double-dummy solvers, bidding engines, a lesson platform) are young and unmeasured on phones, and some carry licence risks. Before committing to a technology path, the team has to prove that these parts can work together on target phones within budget, without leaking hidden cards, and with honest labels (PRD §13.1).

## 2. Solution

A browser-first web application (PA-1). It combines:

- an **authoritative rules core** (the Table), the only component that decides legality, turns, tricks, results and scores (INV-1);
- **robots** that decide from their own seat's view only (ADR-0001);
- a **coach** that states verified facts through teacher-signed templates. Hints use only visible information. Review uses all four hands, labelled as hindsight, and judges decisions on their quality rather than their outcome (CI-1 to CI-3);
- a **lesson player** for authored exercises, and **practice** against robots;
- **local-first progress** with export and import, and no account (FR-P4, NFR-S);
- an **offline content pipeline** that validates, signs off and rights-checks every lesson and template before it can ship (FR-C1 to FR-C4).

Engines (solver, bidding engine, robot policy) run off the main thread behind replaceable interfaces (NFR-M1, NFR-P5).

**Expected experience:** as specified in `docs/ux/ux-spec.md`. A learner opens the app with no account, goes through short lessons, plays practice deals as South, asks for hints when they want them, sees illegal actions refused with a one-line reason, and gets a post-deal review whose "X-ray view" statements are always marked as hindsight.

**Delivery order:**

1. **Phase V (weeks 1–4, hard stop).** A MiniBridge vertical slice: rules core with MiniBridge setup, the duplicate scorer as a standalone component, rule-based robots, one lesson, hint tiers (a) and (c), review with key moments, a provenance panel, and the fixture suites. Alongside it run the device benchmark, licence bill of materials, bidding comparison and optional fair-feedback study harnesses. The rules core, engine interfaces and fixture suites are built to production standard; the slice's UI code may be discarded (PRD §13.3).
2. **Gate (week 5).** Technology selection using V's evidence.
3. **Phase M.** Auction and bidding, full-bridge flow, curriculum, persistence, settings, accessibility, offline use and localisation.

---

## 3. User Stories

Roles: **learner** (P1/P2), **teacher** (P3: content author and reviewer), **engineer** (the delivery team), **owner** (product owner at the gate).

Each story lists its phase and PRD trace. Acceptance criteria are observable at the seams listed in §5.

### 3.1 Table: rules and state

**US-01. Illegal actions are refused with a reason.** *As a learner, I want an illegal card refused with a one-line reason, so that I learn the rule at the moment I break it.*
Phase V, M · FR-R1, FR-R2, FR-E1, INV-1, INV-3

- US-01.1 A card not in the acting hand is rejected with reason `card-not-held`.
- US-01.2 A card of another suit, when the acting hand holds the suit led, is rejected with `must-follow-suit`, and the reason's details name the suit led.
- US-01.3 An action for a seat whose turn it is not is rejected with `not-your-turn`.
- US-01.4 A card from dummy's hand submitted by anyone other than declarer's controller is rejected with `only-declarer-plays-dummy`.
- US-01.5 Duplicate-card input, malformed input, and actions in the wrong phase (for example, a card play during setup) are rejected with `malformed-action` or `wrong-phase`.
- US-01.6 After any rejection, the playthrough record, the turn and all seat views are unchanged.
- US-01.7 Each trick is won by the highest trump played, otherwise by the highest card of the suit led. The winner leads next.
- US-01.8 After the 13th trick, the status is *completed*, and every further action is rejected with `playthrough-complete`.
- US-01.9 Every reason code the Table can emit has a signed-off template in each shipped locale. A missing template fails the build.
- US-01.10 F1 (at least 40 rules cases) passes 100% (VAL-01).

**US-02. The learner plays declarer whenever their side declares.** *As a learner, I want to play declarer whenever my side wins the contract, so that I am never a passive dummy for 13 tricks.*
Phase V, M · ADR-0003, FR-S2, INV-14

- US-02.1 In setup and in defence, the learner controls South only. East and West are always robots.
- US-02.2 When North–South declare with North as declarer, the learner controls North and South (dummy) for every card play.
- US-02.3 When the learner plays from declarer's seat, hints and the learner's decisions use **declarer's** seat view: declarer's remaining hand plus the exposed dummy.
- US-02.4 The record stores the true seat of every action. Rotating the display (UX §3.2) changes nothing in the record or in any seat view.

**US-03. Deals are reproducible from a seed.** *As an engineer or teacher, I want a seed to reproduce a deal exactly, so that defects, fixtures and lesson candidates can be replayed.*
Phase V, M · FR-R8, FR-BOT4, ADR-0002

- US-03.1 The same seed and deal index produce an identical deal, dealer and vulnerability, in Node and in a browser.
- US-03.2 A MiniBridge redeal produces the same next deal for the same seed every time.
- US-03.3 With the same seed, the same learner actions, the same engine versions and no fallback, robot actions are identical across runs.
- US-03.4 The dealing algorithm has published test vectors (seed → deal). Changing the algorithm changes its version identifier, and deals record that identifier.

**US-04. Every playthrough is recorded and replays exactly.** *As a learner, I want my review to describe what actually happened, even after the app updates.*
Phase V, M · ADR-0002, INV-13, FR-R7, FR-R9

- US-04.1 Each playthrough keeps a `PlaythroughRecord` (§4.4) containing every accepted action in order, with its seat, controller and provenance.
- US-04.2 Replay rebuilds every position from the record alone. Replaying a record made with robot policy version *n* gives the identical sequence under version *n+1*.
- US-04.3 The record can be exported as PBN and imported again. Contract Bridge deals, auctions and play round-trip without loss. PBN has no tags for MiniBridge setup (announcements, objective), so those travel in a BridgeVibe-specific supplemental tag and are dropped by other tools; the JSON export is the lossless format. Malformed PBN is rejected with a parse error (FR-R7, Should).
- US-04.4 *(M)* A retry creates a new playthrough whose record starts with a copy of the parent's actions up to the chosen position, plus a link to the parent and the position.
- US-04.5 Practice has no undo. Undoing after robots have played would reveal cards and let the learner replay with hindsight. A mis-tap is prevented by the UX's confirm-to-play (U-10), not repaired afterwards. Undo in lessons (FR-R9) steps back to an earlier step; attempts already recorded are never erased.

**US-05. The rules core runs in browser and Node.** *As an engineer, I want the rules core to run unchanged in both runtimes, so that a server can become authoritative for multiplayer later.*
Phase M (the suite runs in both runtimes from V; see §5.2) · FR-R6

- US-05.1 The F1 and F6 suites pass in Node and in a headless browser from the same build.

### 3.2 MiniBridge setup (slice)

**US-06. MiniBridge setup follows the EBU baseline.** *As a learner, I want MiniBridge setup to work like the EBU's rules, so that I learn the real beginner game.*
Phase V (M only if D5) · FR-R4, PRD §13.4, INV-10

- US-06.1 Each seat's HCP is announced in turn, starting with the dealer. Every announcement equals the true HCP of that hand.
- US-06.2 If each side holds 20 HCP, the deal is replaced by the next deal from the seed. The redeal is recorded in the record's setup events.
- US-06.3 The side with more HCP declares. Within it, the seat with more HCP is declarer; on a tie, the seat that announced first.
- US-06.4 Dummy is exposed before the contract choice. From that moment, dummy's cards appear in every seat view.
- US-06.5 Declarer makes a contract choice of a strain and an objective (*part-score* or *game*). The trick target and the scoring for each objective come from the MiniBridge rules specification (DEP-01).
- US-06.6 A robot declarer chooses the contract with the teacher-approved rule written into the rules specification (DEP-02).
- US-06.7 The seat on declarer's left makes the opening lead.
- US-06.8 The F1 MiniBridge cases pass: 20–20 redeal, declarer ties, dummy exposed before the contract choice, and contract choice.
- US-06.9 A lesson's MiniBridge deal can never be 20–20 (see US-27).

**US-07. Practice gives both declarer and defender roles.** *As a learner, I want to declare in some deals and defend in others.*
Phase V, M · PRD §13.4, FR-S2

- US-07.1 Across consecutive practice playthroughs, the declaring side alternates between North–South and East–West (algorithm in §4.6.3, **Proposed**, U-05).
- US-07.2 A deal rotated to achieve this is recorded as its own deal, with its origin (seed, index, rotation).

### 3.3 Auction (M)

**US-08. Auction legality.** *As a learner, I want illegal calls refused with a reason, so that I learn the auction rules.*
Phase M · FR-R3, FR-E1, glossary *Auction*, *Double*, *Redouble*

- US-08.1 A bid that is not higher than the last bid is rejected with `insufficient-bid`.
- US-08.2 A double is legal only when the last bid is an opponent's and has not been doubled; passes may intervene. Otherwise it is rejected with `double-not-allowed`.
- US-08.3 A redouble is legal only when the last bid is the caller's own side's, has been doubled by an opponent, and has not been redoubled. Otherwise it is rejected with `redouble-not-allowed`.
- US-08.4 Three initial passes do not end the auction. Four passes are a pass-out: status *passed out*, score 0, no play (Q11).
- US-08.5 Once any bid has been made, three consecutive passes end the auction, whether the last other call was a bid, a double or a redouble (for example, 1♥ X Pass Pass Pass ends with 1♥ doubled). Declarer is the first player of the declaring side to have named the final strain.
- US-08.6 Unknown calls, fractional levels and out-of-range input are rejected at run time with `malformed-action`.
- US-08.7 The fixtures include pass-out, three passes followed by an opening bid, doubling partner's bid, doubling twice, and an illegal redouble.

### 3.4 Scoring and result

**US-09. Correct scoring with a breakdown in words.** *As a learner, I want my score explained in words, so that I understand where it came from.*
Phase V (MiniBridge flow; duplicate scorer standalone), M · FR-R5, FR-E3

- US-09.1 The duplicate scorer agrees with two reference scorers on all 2,940 valid combinations, and on the 16 Law 77 examples (F6, VAL-02).
- US-09.2 Invalid scorer input is rejected: tricks outside 0–13 or non-integer, an unknown strain or doubling state, a level outside 1–7.
- US-09.3 MiniBridge scoring follows the named EBU convention fixed in DEP-01, and passes the MiniBridge cases in F6.
- US-09.4 The score breakdown in words matches the scorer's itemised output for every F6 case it covers (FR-E3).
- US-09.5 *(M)* A practice deal shows its dealer and vulnerability, and the score uses them.

### 3.5 Robots

**US-10. Robots never use hidden cards.** *As a learner, I want robots that play fair, so that lesson points work out as they would at a real table.*
Phase V, M · FR-BOT1, CI-9, ADR-0001, INV-4, VAL-05

- US-10.1 The robot policy interface accepts only a seat view, the convention profile, a seed and a deadline (§4.3.3). It is not possible to give it a deal.
- US-10.2 In test builds, every message sent to a robot worker is checked automatically. It must contain no card hidden from that seat (VAL-05 inspection).
- US-10.3 F3 (20 positions × 10 permutations of hidden cards, all consistent with public information including announced HCP and revealed voids) gives identical robot actions with fixed seeds: zero failures.
- US-10.4 Robot actions are shown after a delay that doesn't depend on how long the robot took to decide, or on whether the play was forced. Thinking time would otherwise tell the learner about hidden cards, as a hesitation does at a real table.

**US-11. Robots play legal, plausible, principled cards.** *As a teacher, I want robots to follow basic beginner principles, so that finesses and other lesson points behave realistically.*
Phase V (FR-BOT6 Should), M (Must) · FR-BOT2, FR-BOT6

- US-11.1 Every robot action is accepted by the Table. The F7 soak has zero rejected robot actions.
- US-11.2 The robot follows the teacher-approved principles list (DEP-03): for example, second hand low, third hand high, and cover an honour with an honour where appropriate.
- US-11.3 Both teachers review robot play on the F7 sample deals and find no absurd plays.

**US-12. Robots meet their time budget, and fall back visibly.** *As a learner, I want robots to respond quickly.*
Phase V, M · FR-BOT3, NFR-P4, INV-7

- US-12.1 A robot decision takes at most 1.5 s at the 95th percentile on both reference phones (provisional budget).
- US-12.2 When the deadline passes, the robot takes a fallback action from the fallback policy (§4.6.6). The action is marked `fallback: timeout` in its provenance.
- US-12.3 The benchmark report states, per device and per robot policy, the share of deals with at least one timeout fallback and the number of engine-failure fallbacks. Recommended threshold (U-16): at most 5% of deals with a timeout fallback on the reference Android, and zero engine-failure fallbacks in the F7 soak.
- US-12.4 When the app is in the background or the screen is off, deadlines pause. On return, an interrupted decision is requested again; it is never replaced by a fallback because the phone throttled the worker.
- US-12.5 If an engine worker crashes or runs out of memory, the robot takes a fallback action marked `fallback: engine-failure`, and the worker is restarted. After repeated failures in one session (threshold Proposed), the app stops calling that engine for the rest of the session, and every analysis statement becomes an *unavailable* abstention.
- US-12.6 Robots and the core loop (lessons, play, rules feedback, score) work when WebAssembly is unavailable or blocked (for example, iOS Lockdown Mode or a locked-down school browser). Only analysis-backed features abstain. In V, the robot policy therefore uses no solver.

**US-13. Robot calls follow the profile or say they don't.** *As a learner, I want robot calls that mean what the system says.*
Phase M · FR-B2, FR-B3, INV-7, INV-8

- US-13.1 All four seats and the coach use the single convention profile version recorded in the playthrough.
- US-13.2 Every robot call carries a rule ID, or is marked `fallback: not-covered`. A robot never silently passes in an uncovered auction.

### 3.6 Coach: hints

**US-14. On-demand hints that use only what I can see.** *As a learner, I want a hint when I ask for one, based only on what I could see, so that it is fair.*
Phase V (tiers a and c), M (tier b) · FR-H1–H5, CI-1, CI-4, CI-6, INV-4, INV-11

- US-14.1 Hints appear only when the learner asks, except where a lesson step shows one. Practice never shows an unsolicited hint.
- US-14.2 *(M)* Switching hints off in settings removes the hint control. *(V)* The slice has an on/off toggle.
- US-14.3 Every hint is a statement with mode `VISIBLE`, computed from the seat view of the seat the learner is acting for. When the learner plays from dummy, that is declarer's view.
- US-14.4 **Tier (a):** when the current lesson step has an authored hint, it is shown, with provenance naming the content ID and version.
- US-14.5 **Tier (c):** the sampled estimate draws layout samples consistent with the seat view and the public constraints (announced HCP, revealed voids, cards played). It ranks the candidate cards, treating equivalent cards as one, and words the result with uncertainty. It shows no percentage.
- US-14.6 Tier (c) abstains with *uncertain* when sample confidence is below the threshold (U-02), and with *unavailable* when the solver fails or misses its deadline. The abstention says which.
- US-14.7 Each hint states a reason (principle or facts), not just a card (FR-H4, M; teacher review).
- US-14.8 F3 permutations give identical hint statements, with fixed seeds.
- US-14.10 In an exercise where an exposure has shown hidden cards, tier (c) is not offered, because an estimate that treats visible cards as unknown would contradict the screen. Only tier (a) is offered there.
- US-14.11 On a forced play, the hint states that only one card (or class of equivalent cards) is legal, with no sampling. During the MiniBridge contract choice, the hint is authored (tier a) or a *not covered* abstention; tier (c) covers card play only.
- US-14.12 A hint is tied to the position it was asked for. If the learner acts before it arrives, it is discarded, never shown against the new position.
- US-14.9 *(M)* **Tier (b):** principle hints come from teacher-approved rules and carry their rule ID.

**US-15. Lesson hints don't leak hidden cards.** *As a teacher, I want the pipeline to stop me from writing a hint that reveals hidden cards.*
Phase V, M · Q12, glossary *Lesson Hint*

- US-15.1 A lesson hint declares the cards it refers to as structured references (Proposed, U-12).
- US-15.2 The validity check rejects a lesson hint that refers to a card hidden from the learner's seat, unless an earlier exposure step in the same exercise has shown that card.

### 3.7 Coach: review

**US-16. Replay the whole deal after it ends.** *As a learner, I want to replay the deal with all four hands after it ends.*
Phase V, M · FR-RV1, INV-5, INV-6, INV-13

- US-16.1 Review is available only for a playthrough whose status is *completed*. *(M)* For *passed out*, review shows the auction only.
- US-16.2 Replay steps through setup (MiniBridge announcements; the auction in M), then trick by trick, using only the record.
- US-16.3 Every `ALL_HANDS` statement carries the hindsight label (VAL-07: 100%).
- US-16.4 No `ALL_HANDS` statement, and no hidden card, reaches the UI before the playthrough is completed. This includes the page structure and the accessibility tree: the UI is built from the learner view, which has no identities for hidden cards, so face-down cards cannot be read by a screen reader or by inspecting the page.
- US-16.5 An *abandoned* playthrough has no review, because its hidden cards were never meant to be revealed.

**US-17. See what each of my card plays cost, in hindsight.** *As a learner, I want to know how many tricks each of my plays cost with all cards visible.*
Phase V, M · FR-RV2

- US-17.1 For every learner decision that is a card play, trick cost = the most double-dummy tricks the acting side could take before the play, minus the tricks after it.
- US-17.2 Forced plays have no trick cost and are never shown as decisions. Equivalent cards have the same cost.
- US-17.3 When the learner declared, decisions from both declaring hands are covered.
- US-17.4 Trick costs on F2's 200 mid-play positions agree with native DDS and with macroxue (VAL-03).
- US-17.5 Each trick cost is an `ALL_HANDS` statement with the hindsight label and engine provenance.

**US-18. Key moments judge decisions, not luck.** *As a learner, I want the review to tell a good decision from a lucky or unlucky one, so that I learn judgement rather than hindsight.*
Phase V (curated F4 cases), M (all deals) · FR-RV3, CI-3, INV-9, INV-11

- US-18.1 At most three key moments per playthrough. Only decisions are eligible, never forced plays.
- US-18.2 Each key moment has an assessment of *sound*, *good decision, unlucky layout*, *lucky* or *mistake*, from decision quality and outcome (glossary *Decision Assessment*).
- US-18.3 Decision quality comes from the teacher label for that position when one exists. Otherwise it comes from the sampled estimate on the **historical seat view** at that position, within the acceptability tolerance of the best alternative (provisional: 0.25 tricks over at least 50 samples).
- US-18.4 If decision quality can't be established (no label, and the estimate is uncertain or unavailable), the assessment shows the outcome as an `ALL_HANDS` fact plus an *uncertain* abstention on quality. It is never *mistake* or *lucky*.
- US-18.5 On F4, zero decisions labelled acceptable by the F4 graders (the teachers, or two AI annotators under PRD D10) are assessed as *mistake* (VAL-07). This includes at least five decisions where the correct play loses. Decision points on which the two teachers did not reach a resolved label are excluded from VAL-07 and listed in the report.
- US-18.6 A *lucky* decision is never worded as praise (template review, CI-8).
- US-18.7 *(M)* Calls can be key moments. Their quality comes from the expected call and the accepted alternatives, and their outcome is not assessed.
- US-18.8 The review never contradicts a hint without saying so. Hints and review use the same sample derivation for a position (§4.6.5). If the learner followed a tier (c) hint and the review's larger sample would call the play *not acceptable*, decision quality is *uncertain*, and the review explains that the estimate was close.
- US-18.9 A teacher label applies only when the playthrough reaches exactly the labelled position: the same deal and the same sequence of actions. If the learner took a different line earlier, the label is not used.

**US-19. Retry from a key moment.** *As a learner, I want to try a key moment again.*
Phase M · FR-RV4, FR-R9, INV-16, Q6

- US-19.1 Retry restores the exact position (same remaining hands, trick in progress, turn and contract).
- US-19.2 Decisions in a retry get hints and a review, but create no attempt and change no progress measure.

**US-20. Review works offline, or degrades honestly.** *As a learner, I want review to work without a connection, or to tell me why it can't.*
Phase M · FR-RV5, CI-4

- US-20.1 If the solver runs in the browser, review works with the network disabled.
- US-20.2 If analysis is unavailable, replay still works, and every analysis-backed statement is an *unavailable* abstention.

### 3.8 Lessons

**US-21. Play a lesson end to end.** *As a learner, I want short guided exercises, so that I learn one idea at a time.*
Phase V (one lesson of 3–5 deals), M (all modules) · FR-L1, FR-L3, FR-P1, Q3

- US-21.1 The lesson player runs these steps in order: commentary, exposure, scripted action, prompt.
- US-21.2 A prompt accepts any of its expected answers. When equivalent cards are accepted, the feedback names the alternatives.
- US-21.3 After a wrong answer, the learner may try again. After a second wrong answer, the answer is shown. Either way, the exercise then continues on the script.
- US-21.4 The attempt outcome is *correct* (right first time), *corrected* (wrong, then right without being shown) or *failed* (answer shown).
- US-21.5 A rejected illegal action counts as a wrong answer only if the prompt declares `countsRejections`. Otherwise it gets rules feedback only (Q3).
- US-21.6 An exposure changes only the learner view. Robots and computed hints still work from seat views (ADR-0001).
- US-21.7 In V, one lesson of 3–5 fixed deals plays end to end on both reference phones.

**US-22. Lessons declare what they assume.** *As a teacher, I want each lesson to declare its game format and convention profile.*
Phase M · FR-L6, INV-8

- US-22.1 A lesson whose declared profile version differs from the active one is rejected by the pipeline, or is not offered.

**US-23. The MVP curriculum.** *As a learner, I want ten short modules from cards to a full deal.*
Phase M · FR-L2, FR-L3

- US-23.1 Each module starts with fixed-position exercises before random deals.
- US-23.2 Each module carries a teacher sign-off record (US-26).

### 3.9 Content pipeline (teacher and engineer)

**US-24. Generate candidate deals under constraints.** *As a teacher, I want deals generated to my constraints, so that I can author lessons quickly.*
Phase V, M (Should) · FR-C1, LR-3

- US-24.1 Given a constraint set (for example, a hand's HCP range and suit lengths), the generator produces seeded candidate deals that meet it.
- US-24.2 No generator or filter step uses EPBot or BBA (LR-3).

**US-25. Check that a deal teaches its point.** *As a teacher, I want an automatic check that the intended line actually works.*
Phase M (Should) · FR-C2

- US-25.1 For an exercise that declares a teaching claim (for example, "the finesse is the only way to make the contract"), the pipeline runs double-dummy and, where declared, sampled analysis, and reports whether the claim holds.

**US-26. Teacher sign-off and rights before anything ships.** *As the owner, I want nothing to reach learners without a teacher's sign-off and a rights record.*
Phase M (V: sign-off recorded for the slice's lesson and templates) · FR-C3, FR-C4, CI-8, INV-12, LR-5

- US-26.1 Each content version carries zero or more sign-offs. A release build includes only versions with a valid sign-off and a rights record. Otherwise the build fails.
- US-26.2 A new content version invalidates the earlier version's sign-off for that item.
- US-26.4 *(Recommended, U-17)* A sign-off by the item's author counts only for versions that the pipeline shows change no learner-facing text and nothing that decides correctness (for example, skill tags, metadata or presentation settings). Every new content ID, and every change to commentary, hint or template text, needs sign-off from a teacher other than the author. Text in a locale other than English needs sign-off from a teacher who knows bridge in that language.
- US-26.3 The regression set (CI-8) runs on every engine or content change. Any change in its facts or template IDs fails the run until a teacher re-signs.

**US-27. Validity checks block broken lessons.** *As a teacher, I want the pipeline to reject a lesson with impossible or inconsistent play.*
Phase V, M · FR-L5, FR-L4, ADR-0004, INV-2, INV-15

- US-27.1 The pipeline rejects a deal that doesn't have 52 distinct cards with 13 per hand.
- US-27.2 Every scripted action is checked **by the same rules core** (INV-1). A script that plays a card the seat doesn't hold, or that fails to follow suit, is rejected.
- US-27.3 Every expected answer must be legal at its prompt's position, and consistent with the script.
- US-27.3a If an expected answer differs from the script's card at that prompt (an accepted alternative), the check replays the rest of the script after that answer. The script must stay legal, and the trick winners it assumes must not change; otherwise the author must mark the alternative "accept, then continue with the scripted card".
- US-27.3b The check warns when a card equivalent to an expected answer is not itself listed as expected. The author must accept it or record why not (Bridge-Classroom accepted only ♠J where the prose also accepted the equivalent ♠Q).
- US-27.4 Commentary that names an answer refers to the prompt's expected answers by structured reference, so the prose cannot drift from the answers (Proposed, U-11).
- US-27.5 A MiniBridge exercise deal that is 20–20 is rejected.
- US-27.6 *(M)* A new version of an existing content ID that changes the deal, position, script, a prompt's question or its expected answers is rejected. Those changes need a new content ID (ADR-0004).

### 3.10 Progress and persistence (M)

**US-28. Progress survives on my device and can be moved.** *As a learner, I want my progress kept on my device, and I want to back it up.*
Phase M · FR-P1, FR-P3, FR-P4, INV-15, INV-16

- US-28.1 Attempts and completions survive a reload.
- US-28.2 Lesson completion = every prompt the lesson's current version declares has an attempt. The denominator is the lesson's declared prompts.
- US-28.3 Export, then wipe, then import restores progress exactly. Import replaces the current progress after a confirmation, and the current progress is exported automatically first. An import file is treated as untrusted: it is size-limited and schema-validated, and every record in it is replayed through the Table. A file with an unknown or newer schema version, or any invalid record, is rejected with a message, and existing data is left unchanged.
- US-28.4 Attempts on older content versions remain valid. When a lesson replaces an item with a new content ID, its completion counts the new item.
- US-28.5 No UI copy or stored field uses "mastery".
- US-28.6 The app asks the browser for persistent storage. Safari can delete a site's stored data after 7 days without a visit unless the app was added to the home screen, and school computers often wipe storage at logout. The app therefore offers "add to home screen" and the progress file as calm, optional suggestions; it never uses loss-framed copy (NFR-S). The device test plan includes a storage-eviction check on the reference iPhone.
- US-28.7 When storage is full, the app removes the oldest recent-deal records and their cached review facts first. It never removes attempts or completions, and it tells the learner if anything was removed.
- US-28.8 Every attempt records the highest hint tier used (none, a, b or c), and whether the hint came before the first answer or after a wrong one. *(Recommended, U-15)* Hint use does not change the outcome and is never shown to the learner as a penalty; how it counts is left to the teachers' validated progress formula (FR-P3). Authors who need an unaided measure turn hints off on that prompt.

**US-29. Skill tags.** Phase M (Should) · FR-P2. *As a teacher, I want items tagged with skills.* US-29.1 Every MVP item has at least one tag from the stable taxonomy, and the pipeline rejects unknown tags.

**US-30. Suggested next practice.** Phase M (Could) · FR-P5. *As a learner, I want the app to suggest what to do next.* US-30.1 The suggestion is computed from attempt history only.

**US-31. Resume a deal after closing the app.** *As a learner, I want to pick up a deal where I left it.*
Phase M · FR-R10, Q7

- US-31.1 Closing the app mid-trick and reopening it restores the same position on the same device.
- US-31.2 A resumed playthrough's record is identical to one that was never interrupted.
- US-31.3 The trigger that marks a playthrough *abandoned* is defined (U-09; UX proposes 7 days).
- US-31.4 Only one tab writes progress at a time. A second tab opened on the same device becomes read-only and says so, with an option to take over.
- US-31.5 Each accepted action is appended to the stored record atomically with the playthrough state, so a killed tab loses at most the action in flight. On load, the record is replayed through the Table. A record that no longer replays (for example, after a rules-core fix) is kept, marked as unreplayable, and stays exportable; it is never silently changed.
- US-31.6 An app update takes effect only between playthroughs. If an in-progress playthrough's convention profile, engine or content version is no longer available after an update, it is closed as *abandoned* with a one-line explanation rather than continued under a different version (INV-8, ADR-0002).

### 3.11 Bidding explanations (M)

**US-32. The meaning of any call, or an honest "not covered".** *As a learner, I want to tap any call and see what it means in our system.*
Phase M · FR-E4, FR-B1, FR-B5, Q9

- US-32.1 Every call in the regression auctions shows either a meaning with a rule ID and profile version, or a *not covered* abstention.
- US-32.2 Once the auction is uncovered, robots make marked fallback calls, the coach stops grading later calls, and the learner chooses to continue ungraded or to let the auction be completed with fallback calls for all seats.

**US-33. Feedback on my calls.** *As a learner, I want feedback comparing my call with the system's.*
Phase M · FR-B4, CI-6

- US-33.1 Feedback compares the learner's call with the expected call and the teacher-accepted alternatives. A model's probability alone never decides it.
- US-33.2 The VAL-11 regression set passes at the accuracy threshold.

### 3.12 Reference, settings, platform (M)

**US-34. Rules reference and glossary.** Phase M · FR-E2, FR-E5. *As a learner, I want to look up rules and terms.* US-34.1 Every glossary term used in the UI links to its entry. US-34.2 A lint check fails when a locale's strings use a term the locale glossary marks as *avoid*.

**US-35. Settings.** Phase M · FR-S1, FR-S2, Q10. *As a learner, I want to adjust how the game plays.*
- US-35.1 The settings in FR-S1 persist across reloads.
- US-35.2 Auto-play of forced plays is available in practice only, and is locked off in lessons that teach following suit.
- US-35.3 UX proposals P-1 (highlight playable cards) and P-3 (tap to raise, then confirm) are built only once the owner accepts them into the PRD (U-10).

**US-36. Age gate and privacy.** Phase M · NFR-S
- US-36.1 First launch asks a neutral age question. Under-13s get the UX §2.2 screen and cannot continue to lessons.
- US-36.2 No network request carries personal data. Analytics and error reporting are off until the learner consents.
- US-36.3 The app stores only the age gate's result (13 or over), not the age itself.
- US-36.4 *(Recommended, U-18)* The MVP has one learner per device. All progress is stored under a local learner ID, so profiles can be added later without migrating stored data. A **Start fresh** action offers to save the progress file, then clears progress and settings for the next person. The age gate is answered once per device; that a younger person on a shared device inherits the answer is an accepted limitation.

**US-37. Works offline after first load.** Phase M (Should) · NFR-C3. US-37.1 Lessons, practice and review work with the network disabled, if the gate selects a browser-only architecture.

**US-38. Localisable from day one.** Phase V, M · NFR-I, FR-E5. US-38.1 No learner-facing string is hard-coded. Every one comes from a template or string catalogue keyed by ID, from V onwards.

**US-39. Accessible core journeys.** Phase M · NFR-A. US-39.1 Every core journey can be completed with a keyboard, and with a screen reader that announces cards, tricks, turn and legal options. US-39.2 An audit against WCAG 2.2 AA finds no critical issues.

### 3.13 Engineering and validation

**US-40. Provenance for every statement.** *As a teacher reviewing coach output, I want to see where each statement came from.*
Phase V, M · CI-5, INV-5, NFR-M2

- US-40.1 Every statement has a complete `Provenance` record (§4.4). The F5 schema check passes for every output.
- US-40.2 Internal builds have a provenance panel showing the provenance of the selected statement.
- US-40.3 The provenance log can be exported (V: per session, U-07; M: persisted locally).

**US-41. Engines are replaceable.** *As an engineer, I want to swap any engine without touching the UI.*
Phase V, M · NFR-M1, NFR-M2, G5

- US-41.1 Each engine adapter passes its port's contract suite (§5.2). Replacing one adapter with another needs no change outside the composition root.
- US-41.2 Every third-party engine is pinned to an exact version or commit, and that version appears in provenance.
- US-41.3 The main thread and each engine worker exchange a protocol version when the worker starts. On a mismatch (for example, a cached worker after an app update), the worker is reloaded before any request is sent.

**US-42. Every solver candidate is proven correct.** *As an engineer, I want each solver binding checked against two references.*
Phase V · VAL-03, F2

- US-42.1 On 100 seeded deals plus 200 mid-play positions (tricks 2–12, including mid-trick), each candidate binding has zero mismatches against native DDS and against macroxue. Any mismatch is investigated to its cause.

**US-43. Device benchmark.** *As the owner, I want measured performance on the reference phones before choosing a solver.*
Phase V · T2, NFR-P1–P6, VAL-04, F7

- US-43.1 The harness runs F2 and the F7 100-deal soak on both reference phones for each solver candidate (bridge-dds; macroxue; DDS 3.1 single-threaded, and threaded with cross-origin isolation; pons-dds optional).
- US-43.2 The report gives 95th percentiles for NFR-P1 to P4, the longest main-thread task (P5), peak memory and any crash (P6), the cost per layout sample, and the robot fallback measures in US-12.3. Fallbacks caused by background throttling and *not covered* call fallbacks are excluded; the latter are tracked by the coverage metric (PRD §15).

**US-44. Permutation test.** Phase V, M (re-run on full bridge in M) · CI-9, F3, VAL-05. *As an engineer, I want hidden-card leaks caught automatically.* US-44.1 The suite builds playthroughs from deals that differ only in cards hidden from the tested seat, with identical public history. Robot actions and `VISIBLE` statements are identical, with zero failures. The test runs at the composition seam, not on an isolated function (§5.3).

**US-45. Fault injection.** Phase V, M · CI-4, VAL-06. *As an engineer, I want every failure to produce an honest abstention.* US-45.1 Forcing a solver timeout, a solver error, a worker crash, a worker protocol mismatch, an uncovered situation, low sample confidence and a sampler that finds no consistent layout each produces the matching abstention or marked fallback. There are zero silent fallbacks.

**US-46. Licence bill of materials.** *As the owner, I want every shipped artefact licensed.*
Phase V, M · LR-1–LR-7, T3, VAL-10

- US-46.1 Every build produces a bill of materials: each artefact's licence, version or commit, and required notices.
- US-46.2 Licences are read from the actual licence files, not from repository metadata (LR-7).
- US-46.3 The build fails on any artefact without an explicit grant, any GPL code in the browser bundle (LR-4), or any EPBot or BBA code, binary, derived model or run-time call (LR-3).
- US-46.4 If pons is a candidate, the built artefact is checked for the `american_bba_*` weights, and the check fails if they are present.
- US-46.5 Card faces, suit symbols, icons and fonts are in the bill of materials like code. Free card artwork is often under copyleft or non-commercial licences.

**US-47. Bidding comparison harness.** Phase V · T5, VAL-11. *As a teacher, I want the candidate bidding engines' calls side by side.* US-47.1 For each candidate and each of the 30 auctions, the harness records the call, its rule ID or *not covered*, and its explanation text, in a sheet for both teachers to grade.

**US-48. Fair-feedback study.** Phase V (optional) · T6, VAL-12. *As the owner, I want to know how often double-dummy alone would blame a correct play.* US-48.1 For the F4 decisions, the harness reports double-dummy cost, sampled cost and the teacher label, and computes the rate at which double-dummy alone would blame a correct play.

---

## 4. Implementation Decisions

### 4.1 Architecture

| # | Decision | Status |
|---|---|---|
| 4.1.1 | Browser-first. A server is added only if a Must requirement fails without one | Confirmed (PA-1, PRD §14 *Backend*) |
| 4.1.2 | A single authoritative rules core (the Table); the UI and robots only submit actions | Confirmed (FR-R1, INV-1) |
| 4.1.3 | Every engine (solver, sampler, robot policy, bidding engine) runs in a Web Worker; no engine work on the main thread | Confirmed (NFR-P5) |
| 4.1.4 | The solver is lazy-loaded and not on the critical path to the first lesson | Confirmed (NFR-P1) |
| 4.1.5 | Solver binding and location (browser or server) | **Gate** (VAL-03, VAL-04) |
| 4.1.6 | Rules core: our own TypeScript core, or the extracted ts-contractbridge core | **Gate**; planning default is our own TypeScript core (PRD §12.2) |
| 4.1.7 | Foundation: assemble components, or adapt Bridge-Classroom | **Gate** (T4). Every module boundary and contract in this section applies to either path; on the Bridge-Classroom path they are implemented inside its codebase |
| 4.1.8 | UI framework for phase V: the engineering lead's choice, optimised for speed, because slice UI code may be discarded | Proposed (U-08); the MVP framework is **Gate** |
| 4.1.9 | One repository, with one module per bounded context and enforced dependency rules (§4.2) | Proposed |
| 4.1.10 | The content pipeline is offline tooling. Deal generation may use endplay (Python), but every legality and validity check calls the same rules core in Node, so there is never a second authority | Proposed (follows INV-1) |

### 4.2 Modules and dependency rules

One module per bounded context, plus application and tooling modules. *Owns* is the module's single responsibility.

| Module | Owns | May depend on |
|---|---|---|
| **table** | Cards, deals, dealing, setup (MiniBridge setup in V; auction in M), card play, tricks, result, scoring, reason codes, seat views, playthrough records | nothing |
| **information** | Public constraints, layout sampler, information mode types | table (types only) |
| **analysis** | Solver port and adapters; double-dummy and sampled-estimate services | table, information |
| **bidding** *(M)* | Bidding port and adapters; convention profile; call meanings; coverage | table |
| **robots** | Robot policy port, rule-based policy, fallback policy | table, information, analysis (`VISIBLE` services only), bidding |
| **coach** | Facts, hints (all tiers), review facts, decision assessment, key moments, abstentions, provenance | table, information, analysis, bidding, curriculum (types) |
| **explanation** | Template catalogue, rendering, locale glossaries, rule references | coach (types), table (reason codes) |
| **curriculum** | Lesson model, lesson player state machine, prompts, attempts | table, coach (types) |
| **progress** *(M; V session only)* | Attempts store, completion, export and import | curriculum (types) |
| **app** | Composition root, learner view, worker hosting, persistence wiring, UI | everything |
| **pipeline** | Validity checks, deal generation, sign-off records, rights records, regression runner, bill of materials | table, information, analysis, curriculum, explanation |
| **harness** | Fixture suites F1–F7, device benchmark, comparison and study scripts | everything |

**Dependency rules** (Proposed; enforced by an automated import check in CI):

1. Only **table** can construct a seat view or a completed playthrough record (ADR-0001).
2. **robots** and the hint paths of **coach** can't import any type that carries a full deal.
3. **coach** review functions accept only a *completed* record (§4.3.5).
4. **explanation** never decides; it renders facts, abstentions and reason codes.

### 4.3 Interfaces (ports)

The interfaces below are described by inputs, outputs and guarantees, not by signatures. All calls that cross a worker boundary are asynchronous and take a **deadline** and a **cancellation** signal.

#### 4.3.1 Table

| Operation | Input | Output | Guarantees |
|---|---|---|---|
| start playthrough | deal (or seed + index), game format, convention profile ref *(M)*, learner side, seed | playthrough handle | Status *setup*; record created |
| legal actions | seat | the set of legal actions for that seat now, or empty | Pure; the UI uses it for highlighting (UX P-1) |
| submit | seat, controller, action, provenance | `Accepted` (events: card played, trick won, phase changed, status changed) or `Rejected` (reason code plus details) | Rejection leaves state unchanged (INV-3); controller rules per ADR-0003 |
| seat view | seat | the current `SeatView` | No hidden cards, by construction |
| seat view at | record, position index, seat | the historical `SeatView` | Used by review to assess decision quality (ADR-0001 §2) |
| record | — | `PlaythroughRecord` (in progress or completed) | In-progress records go only to persistence, never to coach |
| position at | record, index | the state at that index | Used by replay and retry |
| score | contract, result, vulnerability, scoring scheme | `Score` with itemised breakdown | Range-checked input (US-09.2) |

**Reason codes**, initial set (Proposed; wording is CI-8 templates):
- V: `not-your-turn`, `card-not-held`, `must-follow-suit`, `only-declarer-plays-dummy`, `wrong-phase`, `malformed-action`, `playthrough-complete`, `not-declarer` (contract choice by a non-declarer), `invalid-contract-choice`.
- M adds: `insufficient-bid`, `double-not-allowed`, `redouble-not-allowed`, `auction-closed`.

#### 4.3.2 Analysis

Two separate capabilities, so that the information mode is enforced by what each one accepts (CI-1, type-level enforcement):

| Capability | Accepts | Returns | Mode |
|---|---|---|---|
| **double-dummy service** | a completed record plus a position index; or, in the pipeline only, a deal plus a position | per-card trick counts for the side to act, with equivalent cards grouped; or the full trick table | `ALL_HANDS` |
| **sampled estimator** | a `SeatView`, candidate actions, a sample count, a seed and a deadline | expected tricks per candidate class, samples used, enumeration flag; or an `Abstention` | `VISIBLE` |

- **Solver port** (what each adapter implements): *solve position* (a full layout, a position including mid-trick, and the side to act → tricks for every legal card) and *solve table* (a layout → a 5 × 4 trick table). Adapters exist for each T2 candidate. Every result carries the adapter's name and version.
- The **sampled estimator** asks the layout sampler for samples, solves each sample with the solver port, and averages. Each sample has its own derived seed, so results are reproducible.

#### 4.3.3 Robot policy

- **Input:** `SeatView`, convention profile *(M)*, seed, deadline.
- **Output:** one action plus provenance: policy name and version, rule ID if any, `fallback` reason if any, duration.
- **Guarantee:** if the policy can't decide in time, the host takes the fallback policy's action (§4.6.6).
- **Implementations:** rule-based visible-information policy (V). A sampled double-dummy policy in M only if T2 shows it fits NFR-P4. A BEN server only if LR-3, LR-4 and D3 allow it (**Gate**).

#### 4.3.4 Bidding (M)

- **call:** seat view in auction → call plus rule ID, or `Abstention(not-covered)` plus a fallback call marked as such.
- **meaning:** call plus auction context → call meaning plus rule ID, or `Abstention(not-covered)`.
- **coverage:** auction → covered or not covered.
- **Engine:** **Gate** (VAL-11).

#### 4.3.5 Coach

| Operation | Accepts | Returns |
|---|---|---|
| hint | `SeatView`, lesson context (current step, if any), hint settings | one `VISIBLE` statement, or an abstention |
| review | a **completed** `PlaythroughRecord`, teacher labels available for this deal | replay model; trick cost per learner decision; up to three key moments with assessments; all `ALL_HANDS` statements labelled |
| assess decision | record, decision index | `DecisionAssessment` (§4.4) |

Review accepts only a completed record. The check is structural (only **table** can produce the completed-record type) and is also checked at run time.

#### 4.3.6 Worker messages

- **Envelope:** request ID, operation, payload, deadline, cancellation ID.
- **Responses:** result, abstention or error, each with provenance.
- **Position key:** every request and response that concerns a position carries the playthrough ID and a position key (a digest of the deal and the sequence of accepted actions). A response whose key no longer matches the current position is discarded (US-14.12). Review results are cached by record ID and engine versions.
- **Protocol version:** exchanged at worker start (US-41.3).
- **Test builds** run an **audit hook** that, for every payload addressed to a robot or `VISIBLE` operation, checks that the payload contains only cards in the named seat's view. A violation fails the test (US-10.2).

### 4.4 Data models

Schemas are versioned. Each persisted or exported document carries a `schemaVersion`. Field lists are normative; encodings are not.

| Entity | Fields | Notes |
|---|---|---|
| `Card` | suit, rank | PBN notation for interchange |
| `Deal` | dealId, four hands, dealer, vulnerability, origin (`seed` + `index` + `rotation` + dealing algorithm version, **or** authored content ID + version) | Immutable (INV-2). dealId is derived from content, so equal deals have equal IDs (Proposed, U-04) |
| `SeatView` | seat, position index, own remaining hand, dummy's remaining hand (if exposed), public information (announcements or auction, contract, every card played by trick, show-outs), convention profile ref | Holds no field that can contain a hidden card. Only **table** constructs it |
| `PublicConstraints` | per hidden seat: exact or range HCP; known voids; known cards played; *(M)* auction-implied ranges and shapes under the profile | Derived from a `SeatView` only |
| `PlaythroughRecord` | schemaVersion, playthroughId, parent (playthroughId + position index) if a retry, deal, game format, convention profile ref, learner side, setup events (announcements, redeals, contract choice; auction in M), actions (index, seat, controller, action, provenance), status, result, score, app version, engine versions | Source of truth (ADR-0002). Controller per action follows ADR-0003 |
| `Provenance` | source kind (authored, bidding rule, engine, template, table) plus the fields CI-5 requires for that kind: content ID + version; rule ID + profile version; engine name + version + mode + sample count; template ID; for robot actions, policy + version + fallback reason + duration | Complete for every statement (US-40) |
| `Fact` | kind (for example trick cost, best card class, expected tricks, legal reason, score item), parameters, information mode, provenance | Engines and rules produce facts; templates consume them |
| `Statement` | fact ID or abstention, template ID, locale, rendered text, information mode, hindsight label flag | Exactly one mode (INV-5) |
| `Abstention` | reason (`not-covered`, `uncertain`, `unavailable`), cause detail, provenance | Never replaced by a substantive default (INV-7) |
| `DecisionAssessment` | decision index, quality (`acceptable`, `not-acceptable`, `uncertain`), quality source (`teacher-label`, `sampled`), outcome (trick cost), verdict (sound, unlucky, lucky, mistake, or none when quality is uncertain) | INV-9 |
| `TeacherLabel` | deal ID, position key (the sequence of actions leading to the decision, not just its index; US-18.9), decision candidates, label per candidate, the two graders and each one's source (`teacher` or `ai`, PRD D10), resolution note and its source (the graders together, or an AI adjudicator under D10) | F4 input (T7a) |
| `Lesson` | contentId, version, game format, convention profile ref *(M)*, exercises (content ID + version), skill tags, rights record, sign-offs | |
| `Exercise` | contentId, version, deal or starting position, script, steps, teaching claim *(optional, FR-C2)* | Validity-checked (US-27) |
| `Step` | kind: commentary (template or string refs, answer references), exposure (cards), scripted action, prompt | |
| `Prompt` | promptId, answer kind (card, call, number, choice), expected answers, `countsRejections` (default false), hint (text ref plus referenced cards), skill tags | Q3, Q12 |
| `Attempt` | learner ID, prompt content ID + version, outcome, hint tier used (none, a, b, c), hint timing (before first answer, after a wrong answer), time, playthrough ID | Appended, never overwritten; replaying a lesson adds attempts. Never created in a retry (INV-16) |
| `SignOff` | content ID + version, teacher, date, scope | INV-12 |
| `RightsRecord` | content ID, source, licence or written grant reference | LR-5, FR-C4 |
| `ProgressExport` | schemaVersion, learner ID, attempts, completions, settings, records of in-progress and recent playthroughs | FR-P4 |

**Storage:**
- **V:** in memory for the session, plus an exported JSON file for records and the provenance log (PRD §13.3 excludes persistence beyond the session).
- **M:** a local browser database (Proposed: IndexedDB) with schema migrations. Nothing is sent to a server.

### 4.5 Information boundary enforcement (ADR-0001)

There are four layers, each verified by a test:

1. **Types:** `SeatView` has no field for hidden cards. Robot and hint operations accept only `SeatView`. Review accepts only a completed record.
2. **Module rules:** the import check in §4.2.
3. **Messages:** the worker audit hook in §4.3.6.
4. **Behaviour:** the permutation suite (US-44).

**Learner view:** composed in **app** from the controlled seat's `SeatView`, plus lesson exposures, plus (after completion) the review layout. It is used for display only, and never passed to robots or to computed `VISIBLE` operations.

**Review analysis timing (Proposed, flagged U-13):**
- ADR-0001 §4 limits the real layout to *completed* playthroughs, so review analysis starts only at completion. Its results are shown progressively as they arrive.
- T2 measures the total time. If it is unacceptable on the reference Android, the owner decides whether to amend ADR-0001 to allow sealed precomputation during play.

### 4.6 Algorithms and rules to pin down

#### 4.6.1 Dealing (Proposed, U-04)

- A named, portable pseudo-random generator, seeded from (seed, deal index), drives a Fisher–Yates shuffle of a canonical card order. Dealer and vulnerability come from the deal index, cycling as on duplicate boards 1–16.
- The algorithm has an identifier and published test vectors. A new algorithm gets a new identifier and never silently changes existing deals.

#### 4.6.2 MiniBridge redeal

On 20–20, take deal index + 1 from the same seed and repeat. Record each redeal as a setup event. Lesson deals are never redealt; they are rejected at validation (US-27.5).

#### 4.6.3 Role mix (Proposed, U-05)

- For practice playthrough *k*, the target declaring side is North–South when *k* is even and East–West when *k* is odd.
- If the seeded deal's declaring side (by MiniBridge HCP; in M, by an HCP proxy before the auction) doesn't match the target, rotate the deal one seat clockwise. With 40 HCP in total and 20–20 already excluded, a one-seat rotation swaps which side holds more.
- The rotated deal is a new deal with its origin recorded (US-07.2).
- In M, the actual declaring side depends on the auction, so the role mix is best-effort and measured.

#### 4.6.4 Trick cost

For each learner card-play decision at position *p*:
1. Call the double-dummy service at *p* to get tricks for each legal card.
2. Cost = the best value minus the value of the chosen card's equivalence class.

This is one solver call per decision, at most 26 per playthrough when the learner declares. The cost of that is checked against NFR-P2 and NFR-P3 in T2.

#### 4.6.5 Decision quality and key moments (Proposed, U-02, U-03)

1. Use the teacher label, if one exists, for (deal ID, position index).
2. Otherwise, run the sampled estimator on the **historical** `SeatView` at that position. Sample seeds derive from the position key, so the review's samples include the hint's samples for the same position (US-18.8). The decision is *acceptable* when its expected tricks are within the tolerance of the best class (provisional: 0.25 tricks over at least 50 samples, CI-3). Below the minimum number of samples, quality is *uncertain*, unless the layouts were enumerated.
3. **Budget (M):** sampling every decision is too costly on phones (50 samples × up to 26 decisions). Sample in this order, within a time budget:
   - decisions with a trick cost above zero (to separate *unlucky* from *mistake*);
   - then zero-cost decisions where the double-dummy values of the candidates differed (candidates for *lucky*).

   Decisions not reached are *uncertain*, and no verdict is claimed for them.
4. **Key moment ranking** (Proposed): *mistake* > *good decision, unlucky layout* > *lucky*, then higher trick cost, then earlier trick. *Sound* decisions are key moments only when fewer than three others exist and the lesson context marks them as teaching points. Pick at most three.

**V:** key moments are evaluated on the curated F4 cases, which have teacher labels. The general path is exercised by the hint tier (c) and by US-48.

#### 4.6.6 Fallback policy (Proposed, U-06)

- **Card play:** a deterministic legal policy. Follow suit with the lowest card; when void, discard the lowest card of the longest non-trump suit; when leading, lead the lowest card of the longest suit.
- **Calls (M):** pass, marked `fallback`.

The teachers review the fallback policy, because its actions can show up in play.

#### 4.6.7 Layout sampler

- Deals the hidden cards to the hidden seats under the public constraints: exact announced HCP (V), revealed voids, cards already played, and, in M, auction-implied ranges and shapes.
- Uses rejection sampling with a deterministic seed and a bounded number of tries. When the number of consistent layouts is small enough to list (threshold Proposed), it enumerates them and sets the enumeration flag (full confidence). When the tries run out, or no layout is consistent, the result is an *uncertain* abstention, never a partial answer.
- **Fixed sample counts.** Each use (robot, hint, review) has a fixed sample count. If the deadline arrives first, the result is a fallback or abstention, never an average over however many samples a fast or slow phone managed. Otherwise outputs would differ by device and break determinism (FR-BOT4) and the permutation test.
- **Ties** between candidates with equal value are broken by a fixed rule (Proposed: the lowest card of the class, then suit order), for robots, hints and the fallback policy.
- Auction-inference constraints are an M extension (PRD §13.2). **Constraint reliability (M, Proposed):** only calls that matched a bidding rule create constraints; fallback calls create none. The learner often bids outside the system, so if constraints taken from the learner's calls leave no consistent layout, they are dropped for that query and the relaxation is recorded in provenance.

### 4.7 Performance and runtime constraints

| Constraint | Source | Design response |
|---|---|---|
| Cold start ≤ 5 s on the reference Android (Fast 4G) | NFR-P1 (provisional) | Solver and sampler lazy-loaded; first lesson needs table, curriculum and explanation only |
| Per-card double-dummy ≤ 1 s; table ≤ 3 s | NFR-P2, P3 | Solver in a worker; review progressive |
| Robot ≤ 1.5 s | NFR-P4 | Deadline plus fallback; no sampling on the robots' critical path in V (PRD §13.4) |
| No main-thread task > 200 ms | NFR-P5 | All engines in workers; record replay is incremental |
| Memory measured; no crash in a 100-deal soak | NFR-P6 | Worker teardown and reuse policy measured in T2 |
| Hint tier (c) latency | **No PRD budget** | U-01 (Proposed: ≤ 3 s at the 95th percentile, with a visible "thinking" state, and the sample count set from T2's cost per sample). Early-trick positions are the slowest to solve, so tier (c) may start speculatively when the learner's turn begins (hints on), and is cancelled when they act. It uses only the seat view, so this is allowed by ADR-0001 |
| Background tabs and screen-off | Mobile browsers | Deadlines pause while the page is hidden (US-12.4) |
| Cross-origin isolation (COOP/COEP) | NFR-C2 | Needed only if a threaded build is selected (**Gate**); the V internal host serves the headers for the threaded T2 variant |

### 4.8 Determinism and versions (ADR-0002)

- Every robot action and fact records the engine name and version. Records are never re-simulated.
- Determinism tests pin the seed, learner actions and engine versions, and they disable deadlines, so no fallback can happen.
- Replay through the Table re-checks legality. Records carry the rules-core version, so a record that a later rules fix rejects can be identified and kept (US-31.5).
- **Solo play trusts the client (NFR-S).** The deal is in device memory and storage during play, so a determined learner can find hidden cards with developer tools. That is accepted for solo play. The UI itself never receives them (US-16.4), and future multiplayer needs server-held deals and redacted views.

### 4.9 Localisation and copy

- Locales, message format, fonts and per-locale sign-off are specified in `docs/i18n/i18n-spec.md` (I18N-nn); its decisions are U-19 to U-27 below.
- All learner-facing text comes from templates (facts, abstentions, reason codes) or string catalogues, keyed by ID (NFR-I). V ships English only.
- The locale glossary lint (FR-E5) and the teacher sign-off of every template (CI-8) are part of the pipeline in M.

### 4.10 Build, hosting and CI (Proposed)

- **CI steps on every change:**
  - unit and fixture suites in Node;
  - table suites in a headless browser;
  - the dependency-rule check;
  - content validation;
  - the regression set (M);
  - the licence bill of materials and licence check.
- **V hosting:** a static host at a private URL, able to serve COOP/COEP headers for the threaded solver variant.
- **Device benchmarks** are run by hand on the reference phones from a harness page, not in CI.

---

## 5. Testing Decisions

### 5.1 Principles

- **Test external behaviour at the highest practical seam.** The fixture suites F1–F7 are the permanent seams, and they stay in the codebase (NFR-M4, PRD §13.9).
- **No mocks of the rules core, ever.** The real solver runs in Node for analysis and coach tests.
- **One kind of test double:** a fault-injecting wrapper around engine adapters, for timeouts, errors, low confidence and uncovered situations (VAL-06).
- **Deterministic by default:** fixed seeds, a controllable clock for deadlines, and pinned engine versions.
- **Committed references:** reference data (native DDS through endplay, and macroxue) is generated offline by a script, committed as data, and tagged with the generator's versions.

### 5.2 Seams and suites

| Seam | What is exercised | Suites and criteria |
|---|---|---|
| **Table API** (start, submit, legal actions, seat view, record, score) | Rules, reason codes, setup, scoring, determinism, replay | F1 (VAL-01), F6 (VAL-02), seed test vectors (US-03), PBN round-trip (US-04.3), replay equivalence (US-04.2). Runs in Node **and** headless browser (US-05) |
| **Solver port contract** (per adapter) | Correctness on full tables and mid-trick positions | F2 per candidate (VAL-03, US-42) |
| **Composition seam:** table + robots + sampler + coach, with the real solver | Information boundary, hints, review facts, assessments, abstention | F3 permutations (US-44, VAL-05); F4 assessments (US-18.5, VAL-07); F5 export for teacher grading (VAL-08); fault injection (US-45, VAL-06); provenance schema check (US-40.1) |
| **Worker boundary** | Message audit | Audit hook active in every composition and end-to-end test (US-10.2) |
| **Pipeline CLI** | Validity checks, versioning rule, sign-off and rights gating | A corpus of good lessons and one bad lesson per rule (US-15, US-26, US-27) |
| **Regression set** *(M)* | Coach output stability | Compares facts and template IDs, not rendered text, and compares cards as equivalence classes, so a solver upgrade that lists equal cards in another order is not a diff. Rendered text changes go through teacher review (CI-8) |
| **End-to-end UI** (headless browser) | Journeys: lesson; MiniBridge practice deal with a hint; review | A few smoke tests in V (US-21.7, US-14, US-16). In M, the §7 journeys of the PRD plus keyboard-only runs (US-39) |
| **Device harness** (manual, reference phones) | Performance and stability | F2 timing, F7 soak, cost per sample (US-43, VAL-04) |
| **Bidding comparison** (V) | Candidate engines on 30 auctions | Graded sheet (US-47, VAL-11) |

### 5.3 Notes on specific suites

- **F3 must test the composition, not a single function.** Robots structurally receive only a `SeatView`, so permuting hidden cards at the robot interface proves nothing. The suite builds whole playthroughs from deals that differ only in the tested seat's hidden cards, drives the same public history through the real table, and compares robot actions and `VISIBLE` statements. This catches leaks in how seat views are built, how workers are wired, and how lessons expose cards.
- **F4** carries labels from two independent graders recorded before week 2 (T7a; AI annotators allowed under PRD D10), with at least five correct-but-losing decisions.
- **F6** includes MiniBridge scoring cases once DEP-01 fixes the convention.
- **Accessibility** *(M)*: automated checks run in the end-to-end suite. The WCAG audit (US-39.2) is manual.

### 5.4 Acceptance-criterion coverage

| Validation criterion | Covered by |
|---|---|
| VAL-01 Rules | F1 at the Table seam (US-01, US-06) |
| VAL-02 Scoring | F6 (US-09) |
| VAL-03 Solver | F2 per adapter (US-42, US-17.4) |
| VAL-04 Device performance | Device harness (US-43) |
| VAL-05 Information boundary | F3 plus message audit (US-10, US-14.8, US-44) |
| VAL-06 Abstention | Fault injection (US-45, US-14.6, US-20.2) |
| VAL-07 Review labelling | F4 at the composition seam (US-16.3, US-17.5, US-18.5) |
| VAL-08 Teacher grading | F5 export plus teacher process (US-40) |
| VAL-09 Learner observation | Human study; UX §13 question set |
| VAL-10 Licences | Bill of materials step (US-46) |
| VAL-11 Bidding | Comparison harness (US-47) |
| VAL-12 Fair feedback | Study script (US-48) |

---

## 6. Out of Scope

**For this specification:**
- Curriculum content (lesson text, deals, explanations). This specification covers the format, player and pipeline only.
- Visual design and interaction detail, which `docs/ux/ux-spec.md` owns.
- The internals of the T4 Bridge-Classroom fit check, and the T7 and T8 human or research tracks. Only their inputs and outputs appear here.

**Deferred by the PRD (non-goals and later phases):**
- Live multiplayer, remote tables and server-authoritative state. The rules core must not prevent them (US-05).
- Accounts and sync, tournaments, ratings, leaderboards, monetisation, native apps, and teacher or classroom management.
- Intermediate and advanced coaching, a second bidding system, a free-form chat coach, and training our own models.
- Language-model phrasing (D7 default: no). CI-7 applies only if it is adopted later.
- BEN or other server robots, unless the gate accepts a backend and LR-3 and LR-4 are cleared.

**Excluded from phase V (PRD §13.3):** auction and bidding in the slice, persistence beyond the session, languages other than English, analytics, public deployment, visual polish, sampling from an auction, the blind opening lead, and the full-bridge permutation re-run.

---

## 7. Further Notes

### 7.1 Assumptions

| ID | Assumption |
|---|---|
| A-01 | Phase V builds MiniBridge card play and setup in the playable flow. The duplicate scorer is built and tested standalone (F6), not in a game flow (PRD §13.2) |
| A-02 | The learner always sits South (FR-S2). Rotating the display is UI-only (UX §3.2) |
| A-03 | The MiniBridge flow in V doesn't need vulnerability unless DEP-01 says otherwise |
| A-04 | Teacher labels exist only for F4 and lesson decisions; practice decisions rely on sampled quality |
| A-05 | The provenance log in V is session-only plus export, reading PRD §13.3 ("no persistence beyond the session") as taking precedence over CI-5's "stored in a local log" for the slice (U-07) |
| A-06 | The reference phones and provisional thresholds are approved in week 0 (PRD §1) |

### 7.2 Dependencies

| ID | Dependency | Needed by | Owner |
|---|---|---|---|
| DEP-01 | One-page MiniBridge rules specification with the EBU text: objectives and trick targets, slam availability, vulnerability, the named scoring convention (Q5). Approved by the owner 2026-10-24: [`docs/domain/dep-01-minibridge-rules.md`](../domain/dep-01-minibridge-rules.md) | Before week 1 | Teaching advisor |
| DEP-02 | The teacher-approved robot contract-choice rule for MiniBridge | Week 1 | Teaching advisor |
| DEP-03 | The teacher-approved list of robot card-play principles. Approved by the owner 2026-10-24: [`docs/domain/dep-03-card-play-principles.md`](../domain/dep-03-card-play-principles.md) | Week 2 | Teaching advisor |
| DEP-04 | Signed-off wording for reason codes, abstentions, the hindsight label and assessment verdicts (CI-2, CI-8; UX §5) | Week 3 for the slice | Teachers |
| DEP-05 | F4 labels | Before week 2 | Both teachers (T7a), or two AI annotators (PRD D10, owner, 2026-10-25) |
| DEP-06 | The two reference phones. **Decided 2026-10-25 (owner):** iPhone 16 (Safari on iOS) and Google Pixel 9 (Chrome on Android) | Week 0 | Owner |
| DEP-07 | D1 bidding system (or the SAYC/2-over-1 common subset). **Decided 2026-10-25 (delegated to Claude by the owner):** SAYC-based; T5 uses the SAYC/2-over-1 common subset (PRD D1) | End of week 1 (T5) | Owner |
| DEP-08 | Licence replies for candidates with unclear terms | During V (T3) | Owner |

### 7.3 Unresolved decisions requiring approval

| ID | Decision | Proposal | Approver |
|---|---|---|---|
| U-01 | Latency budget for hint tier (c); the PRD sets none | ≤ 3 s at the 95th percentile with a visible "thinking" state; sample count set from T2 | Owner + engineering lead |
| U-02 | Sample-confidence threshold for hints (CI-3 only sets the review tolerance) | Reuse at least 50 samples, or full enumeration; otherwise *uncertain* | Teachers + engineering lead |
| U-03 | Key moment ranking | §4.6.5 ordering | Teachers |
| U-04 | Dealing generator, test vectors, and content-derived deal IDs | §4.6.1 | Engineering lead |
| U-05 | Role-mix algorithm (rotation) | §4.6.3 | Teachers + engineering lead |

**Status (2026-10-24).** The owner delegated these calls to Claude. Each is recorded as *Delegated to Claude*, not as an approval (AGENTS.md), and nothing here replaces a teacher's sign-off:

- **U-01:** the proposal is adopted for phase V and built in #23: a 3 s deadline, logged against the 95th-percentile target. The sample count stays provisional (50) until T2 (#28) measures the cost per sample.
- **U-02:** the engineering side is adopted and built in #23 (50 samples, or full enumeration; otherwise *uncertain*). **Teacher sign-off is still pending.**
- **U-05:** the engineering side is adopted and built in #18. **Teacher sign-off is still pending.**
| U-06 | Fallback policy for timed-out robots | §4.6.6 | Teachers |
| U-07 | Whether the V provenance log persists beyond the session | Session plus export (A-05) | Owner |
| U-08 | UI framework for the slice | Engineering lead's choice; MVP framework at the gate | Engineering lead |
| U-09 | Trigger for an *abandoned* playthrough (UX P-5) | 7 days without an action | Owner |
| U-10 | UX proposals P-1 (highlight playable cards), P-2 (rotation ADR-0005), P-3 (tap to raise, then confirm) | Accept into the PRD before M build; each affects table and lesson behaviour | Owner |
| U-11 | How "expected answer consistent with the prose" is checked (FR-L5) | Structured answer references in commentary (US-27.4) | Teachers + engineering lead |
| U-12 | How a lesson hint declares the cards it mentions (Q12) | Structured card references, checked against exposures (US-15) | Teachers + engineering lead |
| U-13 | Review analysis only after completion (ADR-0001 §4), versus sealed precomputation during play | Start at completion and show progressively; revisit with T2 data, which would need an ADR-0001 amendment | Owner |
| U-14 | Sampling budget and order for review decision quality in M | §4.6.5 step 3 | Teachers + engineering lead |
| U-15 | Whether using a hint changes a lesson attempt's outcome | **Recommended:** no change to the outcome and no visible penalty. Record the highest hint tier and its timing on every attempt, because local data can't be backfilled later; the teachers' progress formula decides how it counts. Authors turn hints off where they need an unaided measure (US-28.8) | Teachers |
| U-16 | Maximum acceptable robot fallback rate on the reference phones (the PRD only asks for it to be reported) | **Recommended:** measure per deal, not per decision; a robot makes up to 39 plays per deal, so 2% per decision would put a fallback in about 55% of deals. VAL-04 fails for a solver or policy with more than 5% of deals containing a timeout fallback on the reference Android (about 0.13% per decision), or with any engine-failure fallback in the F7 soak. Throttling and *not covered* call fallbacks are excluded. Mainly decides whether a sampled robot policy is viable for the MVP (US-12.3) | Owner + engineering lead |
| U-17 | Whether a teacher may sign off content they authored | **Recommended:** a teacher other than the author signs off every new content ID and every change to learner-facing text. The author may sign alone only for versions the pipeline shows touch no learner-facing text and nothing that decides correctness. Non-English text needs a teacher who knows bridge in that language. Batch reviews per module, and include reviewer time in the MVP estimate at the gate (RK-12, RK-13; US-26.4) | Owner + teachers |
| U-18 | Several learners sharing one device (siblings, school computers) | **Recommended:** accept one learner per device for the MVP. Profiles wouldn't help on school computers that wipe storage, where the progress file is the carrier. Store progress under a local learner ID now so profiles need no migration later, add **Start fresh**, and ask about shared devices in the beta pilot to decide on profiles (US-36.4) | Owner |
| U-19 | Which locales launch with the MVP (D4) | **Decided 2026-10-31 (owner):** `en` and `zh-Hans`. `zh-Hant`, `ja` and `es` follow, each when complete and signed off (`docs/i18n/i18n-spec.md` §11) | Owner |
| U-20 | Which Spanish | **Decided 2026-10-31 (Delegated to Claude):** neutral Latin American Spanish (`es-419`) with *tú*, served to every `es-*` (i18n spec §11) | Owner + teachers |
| U-21 | Which Traditional Chinese | **Decided 2026-10-31 (owner):** Taiwan terminology, served to `zh-HK` and `zh-MO` too (i18n spec §11) | Owner + teachers |
| U-22 | Japanese register for teenagers | Open: i18n spec §11 | Teachers |
| U-23 | Card-face letters and strain abbreviations per locale | Open: i18n spec §11 | Teachers |
| U-24 | May an AI draft translations? | **Decided 2026-10-31 (owner):** yes, as drafts only, recorded `source: ai-draft`; a bridge teacher in that language signs off every entry (CI-8; i18n spec §11) | Owner |
| U-25 | Message format: in-house ICU subset or a library | Open: i18n spec §6.2, §11 | Engineering lead |
| U-26 | CJK fonts and their delivery | **Decided 2026-10-30:** IBM Plex Sans SC/TC/JP (Delegated to Claude), trimmed at build time and renamed BridgeVibe Sans (owner); the engineering lead approves the pipeline (i18n spec §6.5, §6.6) | Owner + engineering lead |
| U-27 | Rules reference text in other languages | **Decided 2026-10-31 (Delegated to Claude):** translate our own paraphrase, with a Rights Record as original BridgeVibe content; quote no federation translation (i18n spec §11) | Owner |

### 7.4 Edge cases and failure modes added in v0.2

A self-review looked for cases v0.1 did not handle. The ones below changed the specification; they are listed by priority.

| Priority | Case | Where handled |
|---|---|---|
| Fairness | Hidden cards present in the page or accessibility tree, readable by a screen reader or by inspecting the page | US-16.4 |
| Fairness | Robot thinking time revealing hidden cards | US-10.4 |
| Fairness | Undo in practice letting the learner replay with hindsight | US-04.5 |
| Fairness | Tier (c) estimate contradicting cards a lesson has exposed | US-14.10 |
| Fairness | Review calling a hinted play a mistake because it used more samples | US-18.8, §4.6.5 |
| Correctness | Teacher labels keyed by position index match the wrong position after a different line | US-18.9, `TeacherLabel` |
| Correctness | Partial sample counts making results depend on the phone's speed | §4.6.7 |
| Correctness | Auction constraints taken from the learner's off-system calls leaving no consistent layout (M) | §4.6.7 |
| Correctness | Accepted alternatives breaking the rest of a lesson script; equivalent cards missing from expected answers | US-27.3a, US-27.3b |
| Correctness | A late hint shown against a newer position | US-14.12, §4.3.6 |
| Correctness | Auction ending after a double or redouble; MiniBridge setup not representable in PBN | US-08.5, US-04.3 |
| Robustness | Background throttling on phones causing false timeouts and fallbacks | US-12.4 |
| Robustness | Worker crash or out-of-memory; WebAssembly blocked; worker version skew after an update | US-12.5, US-12.6, US-41.3 |
| Robustness | Safari or school machines deleting local progress; storage full | US-28.6, US-28.7 |
| Robustness | Two tabs; a tab killed mid-write; a record a later rules fix rejects; an app update mid-deal | US-31.4–US-31.6 |
| Robustness | A crafted or newer-version import file | US-28.3 |
| Robustness | A sampler that never finds a consistent layout | §4.6.7, US-45.1 |
| Process | Unresolved teacher disagreements; hint use in attempts; self-sign-off; fallback-rate threshold; shared devices | US-18.5, U-15–U-18 |
| Privacy | Storing the learner's exact age | US-36.3 |

### 7.5 Architectural context

- **ADR-0001:** the seat view is the only input for robots, hints and decision quality. This drives §4.3, §4.5 and the F3 design.
- **ADR-0002:** the record, not the seed, is the source of truth. This drives §4.4 and §4.8.
- **ADR-0003:** the learner plays declarer when their side declares. This drives the controller rules and US-02.
- **ADR-0004:** content versions never change correctness. This drives US-27.6 and US-28.4.
- **Gate outputs** that will revise this specification: solver binding and location, rules core origin, foundation, bidding engine, MVP robot policy, backend, and language-model phrasing (PRD §14). After the gate, this document is updated to v0.2, with each **Gate** marker replaced by the decision and a link to the Technology Selection Decision Record.

### 7.6 Traceability (PRD requirement → stories)

| PRD | Stories |
|---|---|
| FR-R1–R10 | US-01, US-03, US-04, US-05, US-06, US-08, US-09, US-19, US-31 |
| FR-L1–L6 | US-21, US-22, US-23, US-27, US-28 |
| FR-E1–E5 | US-01.9, US-09.4, US-32, US-34 |
| FR-B1–B5 | US-13, US-32, US-33, US-47 |
| FR-BOT1–BOT6 | US-10, US-11, US-12, US-06.6 |
| FR-H1–H5 | US-14, US-15 |
| FR-RV1–RV5 | US-16, US-17, US-18, US-19, US-20 |
| FR-P1–P5 | US-21.4, US-28, US-29, US-30 |
| FR-C1–C4 | US-24, US-25, US-26, US-27 |
| FR-S1–S2 | US-02, US-07, US-35 |
| CI-1–CI-9 | US-10, US-14, US-16, US-17, US-18, US-26, US-40, US-44, US-45 (CI-7 out of scope unless D7 changes) |
| NFR-P, NFR-C, NFR-A, NFR-I, NFR-S, NFR-M | US-12, US-36–US-39, US-41, US-43, §4.7, §4.10 |
| LR-1–LR-7 | US-24.2, US-46 |
| VAL-01–VAL-12 | §5.4 |
