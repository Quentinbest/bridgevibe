# Review of the three bridge open-source reuse reports

**Review date:** 2026-10-17 · **Reviewer:** Claude (Opus 5.5), at the repository owner's request

| ID | File | Dated | Length |
|---|---|---|---|
| **A** | `Bridge Web Game Open-Source Reuse Research.md` | 2026-10-17 | 284 lines |
| **B** | `bridge-open-source-assessment-2026-10-16.md` | 2026-10-16 | 254 lines (English + Simplified Chinese) |
| **C** | `bridge-reuse-research-report.md` | 2026-10-17 | 643 lines |

References such as `A:89` mean report A, line 89.

---

## 1. Verdict

**The three reports agree on the core architecture, and that agreement holds up under checking.** No complete open-source game can be forked as-is. DDS is the analysis engine. Double-dummy results must not grade decisions made with hidden cards. A language model should only rephrase facts the engines have verified. The bidding-system choice determines the bidding engine.

**However, each report has at least one error or omission that would change a decision if the report were used on its own.**

- **A** has the strongest tested evidence and the most actionable validation plan. Two of its headline claims need correcting:
  - It says the teaching layer "has no reusable open-source base". That holds for the coach, but not for lessons: A missed Bridge-Classroom (Unlicense), whose lesson player and lesson format are reusable with conditions.
  - Its preferred explanation engine, pons, by default uses a neural fallback trained on EPBot's bids in contested auctions. A excludes EPBot elsewhere on licence grounds.
- **B** is careful and well sourced, but it ran nothing. It also assumes a different product scope (MiniBridge first). Its one positive rules-library recommendation, kduffie/bridge-engine, scores doubled and redoubled contracts wrongly.
- **C** is the most thorough audit of source code and licences, and every defect it reports that I spot-checked was confirmed. But:
  - it judged an archived predecessor of `@bridge-tools/core`;
  - it leaves out macroxue/bridge-solver;
  - it ran 9 of Bridge-Classroom's 70 test files;
  - it cites nine evidence files that are not in the repository;
  - it is long and heavily qualified, so the decision is hard to extract.
- **The reports do not share a requirements baseline.** B treats "MiniBridge first" as confirmed scope (`B:17`). A and C never mention MiniBridge. Their recommendations cannot be compared or combined until this is settled.

**Recommended use:** apply the errata in §9.2, then use:
- C as the candidate and licence register;
- A as the validation playbook and the source of double-dummy evidence;
- B as the MiniBridge rules specification and acceptance criteria, if MiniBridge first is confirmed.

None of the three should go to a decision-maker uncorrected.

---

## 2. Scope and method of this review

- I read all three reports in full.
- On 2026-10-17 I **spot-checked 31 decision-relevant factual claims** against primary sources (log in §8):
  - the GitHub REST API: repository metadata, default-branch commit history, recursive trees, and file contents at the exact commits the reports cite;
  - the npm registry and published package contents (unpkg);
  - the BBO News article cited by A;
  - the EBU MiniBridge rules page cited by B.
- I re-ran a sample of A's GitHub search queries to test its coverage claims.
- I chose the checks where the reports disagreed or where a claim drove a recommendation. They are targeted, not a random sample, so the scorecard ratings in §4 are judgements informed by the checks, not measured error rates.
- **Not done:**
  - I built or ran no upstream code. Results the reports tagged as tested were checked for internal consistency and against the source, not reproduced.
  - GitHub search ranking changes over time, so the re-run searches are indicative rather than proof.
  - Nothing here is a legal opinion.

Severity scale used in §6:
- **Major:** changes a recommendation or headline conclusion.
- **Moderate:** weakens a claim or needs explicit qualification.
- **Minor:** accuracy or presentation, with no decision impact.

---

## 3. The reports at a glance

| | A | B | C |
|---|---|---|---|
| Product scope assumed | Web bridge game: tutorials, rules explanations, AI coach | Web **MiniBridge** learning game for complete beginners; bidding deferred | Web bridge game: beginner curriculum, improvement coach |
| Candidates assessed | 26 table rows (about 30 repositories) | 19 | About 45, including screening tables |
| Code actually run | About 9 projects: differential double-dummy tests on 100 deals, full test suites, BEN API | None (`B:13`, `B:123`) | 8 limited checks: selected test files, scoring probes, mocked suites |
| Evidence labels | Documented / Inspected / Tested | Source inspected / Documentation screened | Documented / Inspected / Tested / upstream CI |
| Commit pinning | 7-character commit hashes in text; links point to branch heads | Full-hash permalinks for 10 repositories | Full-hash permalinks throughout |
| Headline recommendation | Build our own app; reuse DDS WebAssembly and pons (if 2/1); build the teaching layer | Reuse DDS, bridge-dds-js and endplay; build the learning layer | Two conditional paths: adapt Bridge-Classroom, or assemble components |

---

## 4. Scorecard

Ratings: **Strong**, **Adequate** or **Weak**, each with the main reason.

| Dimension | A | B | C |
|---|---|---|---|
| **Source reliability** | **Adequate.** Primary sources and cited commits. But links point to moving branches, and some dates and licences came from GitHub metadata (push dates, the automatic licence detector) and are wrong | **Adequate.** Full-hash permalinks and authoritative EBU sources. Maintenance is judged from push dates | **Strong.** Full-hash permalinks, licences read file by file, CI run IDs. One stale (archived) repository |
| **Methodological soundness** | **Adequate.** Best-documented search, with a stopping rule and real differential tests. But its own queries surface candidates it never discusses, there is no record of why roughly 420 repositories were excluded, and its counts are inconsistent | **Weak.** Nothing executed, 30 results per query, 19 candidates. It is honest about this | **Adequate.** Widest coverage. But test runs were selective, the companion evidence is missing, and the search cannot be reproduced from the repository |
| **Fairness of comparisons** | **Adequate.** Consistent evidence labels. But its "Yes = tested here" legend is misapplied, and eBridge was rejected on an incomplete reading of its licence | **Strong.** Even-handed, with modest claims | **Strong.** Consistent gates, explicit about what can and cannot be compared, refuses a false leaderboard. But bridge-tools was judged on old code |
| **Sufficiency of evidence** | **Mixed.** Strong for double-dummy solvers (100 deals, an independent cross-check). Weak for bidding explanations and teaching | **Weak** for its positive reuse recommendations; adequate for its rejections | **Mixed.** Strong for licence and defect claims. Weak for runtime behaviour: most results labelled as tested come from probes or mocked suites |
| **Soundness of conclusions** | **Adequate.** Engine conclusions are sound. The "no teaching base" headline and the claim that pons explains every bid are not | **Adequate.** Appropriately modest; one positive recommendation is contradicted | **Strong.** Well qualified. But macroxue is missing, and the final decision is deferred |
| **Practical engineering value** | **Strong.** Time-boxed experiments with pass criteria (for example `A:239`) | **Adequate.** MiniBridge rules specification, acceptance table and information-boundary test; no thresholds or time boxes | **Adequate.** The licence checklist and defect list are high value. But it is 144 KB with no thresholds, time boxes or effort sizing |

---

## 5. Conclusions that hold up

All three reports reach these conclusions independently, and nothing I checked contradicts them. They can be treated as settled for planning.

1. **Do not fork a complete open-source game.** Every complete game examined is outdated, desktop-only, unlicensed, incomplete or rule-incorrect.
2. **Use DDS (Apache-2.0) for double-dummy analysis.** It runs in the browser through WebAssembly. The official 3.1 build asks for 256 MB of initial memory, an 8 MB stack and a pool of 8 threads, and its threaded build needs cross-origin isolation (confirmed in `docs/wasm_build.md`, lines 156–158). Mobile behaviour has not been measured.
3. **Double-dummy analysis is a grader, not a tutor.** Feedback during play must use only what the player could see. Review with all hands visible must be labelled as such. All three reports give the same counterexample: a correct finesse that loses.
4. **Engines decide; the language model only phrases.** Legality, scoring and correctness come from rules engines and solvers. An LLM may only rewrite facts they have verified.
5. **The bidding system determines the bidding engine:** 2/1 points to pons, Bridgit or rusty-bidding-bot; SAYC to saycbridge; other systems have no ready explainer.
6. **The decisive unknowns are the same in all three:** performance on phones, a bridge teacher's judgement of the explanations, evidence that learners improve, and maintainer and licence risk.

---

## 6. Findings

### 6.1 Disagreements, and what the primary sources show

| Question | A | B | C | What the primary source shows | Consequence |
|---|---|---|---|---|---|
| Is there a reusable teaching or lesson base? | No (`A:7`, `A:89`) | Only unlicensed references | Yes, conditionally: Bridge-Classroom and the Baker lessons (`C:7`) | Bridge-Classroom is **Unlicense**, created 2026-01-28, with its latest commit on 2026-10-15. Baker-Bridge is **Unlicense** and holds PBN lessons. But Classroom grades students against BBA's auction (`localEngine.js`, comment lines 27–28) | **A's headline holds for the coach, not for lessons.** C is right, with its stated conditions |
| Does pons give authored explanations for every bid? | Yes (`A:10`) | n/a | No: its default mixes authored rules with a neural fallback (`C:540`) | `american()` calls `with_floor_v6`. The v6 weights' sidecar file records `"teacher": "bba"`, and `neural_floor.rs` describes the earlier floor as "Distilled from the vendored **EPBot** 2/1 oracle". Weight files `american_bba_v*.f32` are in the repository. `american_instinct()` is the fully deterministic alternative | The fallback serves contested auctions; uncontested auctions, where most beginner material sits, use fixed rules according to the assembly documentation. So the effect on beginner explanations is limited, and licensing is the main issue. The weights are compiled in with `include_bytes!` whatever the entry point, so excluding them needs a build change, confirmed in the built artefact. This also affects A's commercial-use guidance (`A:216`) |
| Do pons's sampled evaluations judge fairly, from what the player could see? | Yes: it samples hidden hands (`A:182`) | n/a | No: its `oracle()` function knows both partnership hands (`C:542`) | `single_dummy.rs` samples only for declarer before play, the opening leader and declarer during play. Defenders play double-dummy. `oracle()` is a separate function | Both are partly right. The accurate label is **Partly** |
| eBridge licence | None (`A:80`) | Not identified (`B:51`) | ISC declared in its package files (`C:449`) | `license: ISC` in the root, `api/` and `web/` `package.json` files, each with an empty `author` field, which matches the `npm init` default. There is no LICENSE text file | "Unclear" is the precise label: a declaration exists, but it is weak. The outcome (unsuitable) stands on functionality grounds |
| kduffie/bridge-engine | Not covered | Partial reuse, conditional (`B:43`) | Reference only: scoring defects (`C:407`) | `getScore` has no doubling multiplier on trick score, no bonus for making a doubled contract, and a game bonus that ignores doubling. So non-vulnerable 2♥ doubled, made exactly, scores **110 instead of 470** | **Downgrade B's classification to reference only** |
| GNUBridge robots | They see all four hands (`A:168`) | "Historical algorithm reference" | Not established (`C:437`) | The game screen's search worker builds `new DoubleDummySolver(game)` from the live deal | A is right. Add this to C |
| bridge-tools | `@bridge-tools/dd` 0.2.2 tested and found defective (`A:167`) | n/a | Judges the archived `bridge-tools/core` 0.0.8 and says its solver is still only planned (`C:479`) | The current packages are `@bridge-tools/core` **0.3.1** and `@bridge-tools/dd` **0.2.2**, both from the `aaron-hutton/bridge-tools` monorepo (last commit 2025-05-17) | C's defect probes apply to code from 2022. Re-check the current version |
| DDS release status | Tags v3.0.0 to v3.1.1 (`A:102`) | n/a | Latest release is 3.1.0 (`C:514`) | Tag `v3.1.1` exists; the latest GitHub release is `v3.1.0` (2026-08-19) | Both are right. Pin to the v3.1.0 release or an explicit commit |
| Product scope | Full bridge | **MiniBridge first, "confirmed"** (`B:17`) | Full bridge | n/a | **An owner decision is needed** (§9.1) |

### 6.2 Report A

**Strengths**

- **Real differential testing.** Three double-dummy solvers were run against native DDS on 100 seeded deals, including an independent solver (macroxue) as a cross-check (`A:253-258`). This is the strongest tested evidence in the set.
- **A documented search method:** platforms, query families, counts, non-English terms, a stopping rule and known gaps (`A:16-40`).
- **An evidence label on each judgement,** plus the commits inspected.
- **A clear coaching-needs matrix** and a well-argued "grader, not tutor" point (`A:186-190`).
- **The most actionable plan:** five experiments with time boxes and pass criteria (`A:236-243`).

**Issues**

| # | Severity | Finding |
|---|---|---|
| A1 | **Major** | **The headline "the teaching layer has no reusable open-source base" (`A:7`, `A:89`, `A:194`) holds for the coach but not for lessons.** Bridge-Classroom (Unlicense) has a reusable lesson player, lesson format and progress model, under the conditions C lists. A never mentions it, nor Baker-Bridge, rusty-bidding-bot, kduffie/bridge-engine or BridgeZ. Bridge-Classroom is hard to find by keyword (its description is "Bridge Training and Student Proficiency Tracking tools"), so the miss is understandable. *Improvement:* keep an exclusion log. A filtered roughly 420 repositories without recording why. For example, its "contract bridge" query (top 100) returns Nickel Bridge at rank 76. Nickel has no licence, so A would have rejected it, but a log would show it was seen and why it was dropped. |
| A2 | **Major** | **pons is presented as an authored explainer with "readable constraints to every bid" (`A:10`), but its default system has a neural fallback trained on EPBot's bids** (see §6.1). The fallback serves contested auctions, so most beginner explanations are unaffected; licensing is the main issue. A says EPBot is "excluded from the crate" (`A:133`) and recommends excluding EPBot for commercial use (`A:216`), but it does not flag the EPBot-derived weights, which are compiled into the library. *Fix:* name `american_instinct()` as the system to evaluate, produce a build without the `american_bba_*` weights and confirm it in the artefact, and add this to the commercial-use row. |
| A3 | Moderate | **The summary overstates the double-dummy evidence: "solved and verified" in the browser (`A:9`).** The bridge-dds package was tested in Node 18 after a patch to its imports (`A:254`), not in a browser. The per-card check covers only 10 opening-lead positions (`A:255`); the "this card cost you a trick" feature needs positions in the middle of a trick. bridge-dds and the reference (endplay) both contain DDS 2.9 code, so their agreement validates the WebAssembly build, not the solver; macroxue provides the only independent cross-check. Phones were not tested; A says so in its gaps section (`A:229`) but not in its summary. |
| A4 | Moderate | **The evidence legend is misapplied.** The coaching table defines "Yes" as "tested here" (`A:175`), yet the strength rows for BEN and pons were never tested. The fairness "Yes" for pons holds only for declarer and opening-lead decisions (see §6.1). The summary calls BEN "the strongest open robot **tested**" (`A:11`), but only its API was exercised. The one strength figure cited is BBO's 2024 data for a different variant (ACBL-Ben, trained on 100 million ACBL hands), which puts it *below* Advanced GIB on declarer play in suit contracts: 48.41% vs 55.93%. The quoted figures match the source. |
| A5 | Moderate | **Four metadata errors that A's own conventions (`A:52`) should have prevented:** <br>• Bridge-Package's "last commit 2023-01-04" (`A:83`) is the push date; the last commit was 2020-11-02. <br>• redeal's "Unclear (NOASSERTION)" (`A:73`): its `LICENSE.txt` says GPL v3; GitHub's licence detector simply failed. <br>• macroxue/bridge-solver has **492 commits, 159 of them in 2026**, not "55 commits" (`A:122`). It is still essentially a one-maintainer project. <br>• ts-contractbridge's MIT licence covers only `packages/ts-contractbridge`; the repository root has no licence. <br>One imprecision: eBridge's licence is listed as "None" (`A:80`), where "unclear" is more accurate (see §6.1). <br>*Improvement:* read dates from commits and licences from files, as A's conventions already intend. |
| A6 | Minor | **Internal inconsistencies.** "26 were cloned … and 4 were run" (`A:18`), but the test log runs about 9 projects. "Seven projects were shortlisted" (`A:93`), but 8 are assessed. The architecture diagram is missing: there is a placeholder at `A:196`, and the next line refers to a "shaded area". Links point to `main`/`master`, not the cited commits (`A:97`), so references such as `DealController.java:99` will drift. The test scripts are not included, so tested results cannot be re-run. |
| A7 | Minor | **The `@bridge-tools/dd` rejection rests on one run of A's own test script in a single process** (`A:256`). The cause (a state leak in the library, or misuse of its API) was not isolated, and no upstream issue was filed. "Do not use" is reasonable, but it should read "failed our test script" until reproduced. |

### 6.3 Report B

**Strengths**

- **It is the only report that applies MiniBridge rules, taken from an authoritative source (EBU).** I confirmed those rules: redeal at 20–20, the higher-scoring partner declares, the first to announce wins a tie, and dummy is shown before the contract is chosen. Using them, B found real rule deviations in maxgiraldo/playbridge, also confirmed: North-South declare whenever their points are greater than or equal to East-West's, so a 20–20 hand is not redealt; within-pair ties go to South or West; the solver stops at 40,000 nodes, skips positions with more than 24 cards and falls back to an HCP estimate.
- **A strong test design for information discipline** (`B:82`, `B:116`). It checks that advice does not change when hidden cards are swapped and the public history stays fixed. This should become a permanent automated test in our codebase.
- **Two practical points the other reports lack:** downloadable teaching material (EBED) is not the same as permission to reuse it (`B:90`), and connecting BEN to MiniBridge risks inventing a misleading auction (`B:107`).
- **Honest about its limits throughout,** with full-hash permalinks and a Chinese translation that mirrors the English section by section (not compared line by line).

**Issues**

| # | Severity | Finding |
|---|---|---|
| B1 | **Major (scope)** | **B's requirements baseline differs from A's and C's.** It says "Confirmed: … MiniBridge first" (`B:17`); A and C never mention MiniBridge. If MiniBridge first is right, the bidding engines A and C focus on (pons, saycbridge, rusty-bidding-bot) move to a later phase, and B's rules layer becomes the critical path. If it is wrong, B's shortlist leaves out every bidding and explanation engine. |
| B2 | Moderate | **The evidence is too thin to support positive reuse recommendations.** Nothing was executed (`B:123`), GitHub searches were sampled to 30 results (`B:25`), and only 19 candidates were assessed. This is enough to support rejections, not "prefer" or "partial reuse" recommendations. |
| B3 | Moderate | **kduffie/bridge-engine should be reference only, not conditional partial reuse (`B:43`, `B:103`).** Its contract scorer gets doubled and redoubled contracts wrong (§6.1), and C also found problems with turn order. B's caveat "only if they pass tests" (`B:61`) is right, but the classification should reflect what is now known. |
| B4 | Minor | **Push dates used as the maintenance signal.** Even though they are labelled, they mislead: redouble shows "pushed 2022-07-19" (`B:50`) but its last source commit is 2019-04-09; brl shows 2024-07-25, but its last commit is 2024-06-03. eBridge's ISC declaration is also not mentioned. |
| B5 | Minor | **Bridge-Classroom and Baker-Bridge are not assessed.** Their lesson format, PBN instruction specification and progress architecture are relevant even for a MiniBridge-first product. |

### 6.4 Report C

**Strengths**

- **The broadest coverage.** It found the 2026 bridge-craftwork projects (Bridge-Classroom, rusty-bidding-bot, BidBase, Baker-Bridge), which materially change the picture (`C:58`).
- **Licences read file by file.** This catches cases where GitHub's licence detector fails (BridgeZ, PbnTools). The per-path licence and distribution checklist (`C:616-637`) is the most directly useful compliance document in the set.
- **Concrete defects in candidate libraries, and every one I spot-checked is confirmed:**
  - kduffie's scoring;
  - GNUBridge's scoring tests, which expect 680 for 6♠ made exactly (missing the 300 game bonus) and 110 for 1♥ doubled made exactly (missing the 50 bonus for making a doubled contract);
  - Baker-Bridge's `SecondHand.pbn`, Board 2, where `[PLAY E:C2]` has East playing ♣2 although East's clubs are 8654 (♣2 is South's);
  - Bridge-Classroom's mastery denominator, which counts distinct boards seen across *all* users;
  - Bridgit's `ExplainHistory` and `SummarizeHistory`, which throw `NotImplementedException`;
  - BEN's default config, which consults BBA (`consult_bba = True`, `use_bba_rollout = True`);
  - Nickel Bridge's grading thresholds (60% / 20% / 5% of the best move's model probability).
- **Precise conceptual distinctions:** a bid's meaning is not the reason for choosing it, and a model's probability is not a measure of correctness. It also declines to build a strength leaderboard from figures that cannot be compared (`C:152`).

**Issues**

| # | Severity | Finding |
|---|---|---|
| C1 | Moderate | **bridge-tools was judged on archived 2022 code** (`C:475-485`). The current packages (`@bridge-tools/core` 0.3.1 and `@bridge-tools/dd` 0.2.2) live in `aaron-hutton/bridge-tools`. C's own method says repositories were "followed to the canonical current owner" (`C:43`), but here they were not. Its statement that the solver package is only "planned" is out of date, although A found the shipped solver defective. |
| C2 | Moderate | **macroxue/bridge-solver is left out.** According to A, it is the only *independent* double-dummy solver whose agreement with DDS was confirmed (100/100 deals), and its WebAssembly is 72 KB. That matters most for C's browser-only and offline branch (`C:174`), which compares only bridge-dds-js and pons-dds. |
| C3 | Moderate | **The tested evidence is thinner than the "Behavior actually checked" table (`C:106-119`) suggests:** <br>• Bridge-Classroom: 9 of **70** test files, with no reason given for the selection (`C:237`). <br>• DDS: 288 tests run against a mocked interface (`C:516`). <br>• bridge-dds-js: two solved tables, "25 checked cells" (`C:116`). <br>• saycbridge: 32 core tests that do not exercise the bidder. <br>Each row states its own limits honestly, but a reader skimming the table may take it as validation. |
| C4 | Moderate | **The evidence package is missing.** Nine files cited as the record are not in the repository: `TEST_EVIDENCE.md`, `score_probe.cjs`, `score_probe_results.json`, `compile-inspection.cjs`, `smoke-checks.cjs`, `smoke-results.json`, `metadata.json`, `search_log.json` and `discovery.json` (`C:237`, `C:407`, `C:503`). Neither the search nor the probes can be reproduced from what was delivered. |
| C5 | Moderate | **Hard to act on.** It is 144 KB with heavy qualification throughout, and gives no pass thresholds ("decide acceptable limits…", `C:193`), no time boxes and no effort sizing. "No implementation path … is selected by this report" (`C:14`). The decision-relevant content (§§1, 6–7) is about 15% of the document. Internal research-process vocabulary leaks into the text: "lane" (`C:223`, `C:350`, `C:454`) and a note on relabelled evidence codes (`C:56`). |
| C6 | Minor | **GNUBridge's information flow is called "not established" (`C:437`),** although the game screen's search worker solves the live deal (A's finding, confirmed). |
| C7 | Minor | **Typographical damage and duplication.** Spaces are missing in many places, for example "about8GB" (`C:435`), "31Mar2021" (`C:449`), "Python3.12" (`C:524`) and "release0.8.8.8" (`C:530`). PyBridge and Free Bridge each appear in two tables (`C:351-352`, `C:456-457`). |

### 6.5 Issues common to all three reports

- **Source reliability.** Primary sources dominate, which is right. Many cited projects are very young and change quickly, and several are developed largely with AI coding agents (for example, 43 of saycbridge's 48 commits in 2026 are authored as "Claude Code sessions"). C documents several READMEs that no longer match their code. Claims taken only from a README should be treated as unconfirmed.
- **Methodology.** None of the reports records why discarded candidates were excluded, and none contacted a maintainer. Their search depths differ (30 results, 100 results, or "limited first pages"), which largely explains why their candidate sets differ. Together the three cover materially more than any one of them.
- **Fairness.** All three avoid popularity metrics and apply a licence gate. Relying on GitHub's automatic licence detector (A, and partly B) penalised projects inconsistently. On BEN's GPL-3.0 licence, none of the reports cleanly separates hosting it as a service from distributing it. GPL-3.0 has no network-use clause (unlike AGPL), so the real blocker is BEN's bundled BBA, BGA and SuitC binaries and its EPBot- and GIB-derived data. *This is not legal advice; confirm with counsel.*
- **Shelf life.** Most of the decision-relevant candidates were created in 2026:
  - Baker-Bridge (2026-01-23), Bridge-Classroom (2026-01-28) and pons-dds (2026-05-28);
  - ts-contractbridge (2026-06-03), Nickel Bridge (2026-07-12) and maxgiraldo/playbridge (2026-09-10);
  - rusty-bidding-bot (2026-09-21) and BidBase (2026-10-09).

  DDS 3.0 itself was released on 2026-05-18. Any recommendation on this landscape will go stale quickly.
- **Engineering value.** None of the reports estimates the effort of building our own teaching layer versus adapting Bridge-Classroom, which is the central build-or-adapt choice.

---

## 7. Coverage across the reports

| Candidate | A | B | C | Note |
|---|---|---|---|---|
| DDS 3.x | ✓ (tested) | ✓ | ✓ | All agree |
| bridge-dds-js | ✓ (100 deals tested) | ✓ | ✓ (2 tables) | A has the strongest evidence |
| macroxue/bridge-solver | ✓ (tested) | ✓ | — | C omits it (C2) |
| pons | ✓ (test suite run) | — | ✓ (hybrid default found) | Combine: A's test run plus C's provenance finding |
| rusty-bidding-bot, BidBase | — | — | ✓ | Only C |
| Bridge-Classroom, Baker-Bridge | — | — | ✓ | Only C; narrows A's headline to the coach |
| Nickel Bridge | — | ✓ | ✓ | No licence (confirmed) |
| bridge-game-coach, maxgiraldo/playbridge | — | ✓ | ✓ / — | No licence (confirmed) |
| kduffie/bridge-engine | — | ✓ (favourable) | ✓ (defects) | C confirmed |
| saycbridge, Bridgit, BEN, endplay | ✓ | BEN, endplay | ✓ | Broadly consistent |
| MiniBridge rules | — | ✓ | — | Only B |

---

## 8. Verification log

These are the checks run on 2026-10-17 against the commits each report cites, unless a row says otherwise.

| # | Claim (report) | Result | Primary evidence |
|---|---|---|---|
| 1 | Bridge-Classroom is Unlicense, young and active (C) | **Confirmed** | Root `LICENSE` is the Unlicense; created 2026-01-28; latest commit `f97dab8`, 2026-10-15 |
| 2 | Bridge-Classroom grades students against BBA, and falls back to BBA's call when Rusty has no rule (C) | **Confirmed** from source comments and code; not executed | `localEngine.js` comment lines 21–30; `rustyBidder.js` lines 3, 41–47 |
| 3 | Bridge-Classroom's mastery denominator counts boards seen across all users (C) | **Confirmed** | `lesson_mastery.rs` lines 41–43 and 115–135 (`COUNT(DISTINCT deal_number)`) |
| 4 | Bridge-Classroom tests: 125/125 passed in 9 files (C) | **Partly.** 9 of 70 test files at the cited commit | Recursive tree contains 70 test files |
| 5 | Baker-Bridge `SecondHand.pbn` Board 2: East is shown playing ♣2, which South holds (C) | **Confirmed** | East's clubs are 8654, South's are A2; the file contains `[PLAY E:C2]` |
| 6 | pons attaches readable constraints to every bid (A) | **Refuted for the default system** | `american()` → `with_floor_v6`; the v6 weights' sidecar `american_bba_v6.json` records `"teacher": "bba"`; `neural_floor.rs:68` says the v4 floor was "Distilled from the vendored EPBot 2/1 oracle". (A doc comment on `american_instinct()` says "the nets clone *this*"; it may describe a different family of nets. The sidecar is the more specific record.) The weights are embedded with `include_bytes!` (`neural.rs` lines 114 and 158–163) |
| 7 | pons samples hidden hands (A) and its oracle knows both partnership hands (C) | **Partly, both** | `single_dummy.rs` lines 1–30 (declarer and leader views; defenders double-dummy); `web/src/lib.rs:611` `oracle` |
| 8 | pons: 1,661 commits since 2023-03 (A) | **Confirmed** | 1,661 commits at `a9362f9` |
| 9 | eBridge has no licence (A) / licence not identified (B) / ISC in manifests (C) | **Declared, but weak** | `license: "ISC"` in the root, `api/` and `web/` `package.json`, each with an empty `author` field (the `npm init` default); no LICENSE file |
| 10 | redeal's licence is unclear (A) | **Refuted** | `LICENSE.txt`: "released under the GNU General Public License v3.0" |
| 11 | Bridge-Package last commit 2023-01-04 (A) | **Refuted** (that is the push date) | Last default-branch commit `6a4463c`, 2020-11-02 |
| 12 | macroxue/bridge-solver: 55 commits, dual MIT/Apache (A) | **Count refuted; licence confirmed** | 492 commits, 159 since 2026-01-01, top contributor 389; `LICENSE-MIT` and `LICENSE-APACHE` both present |
| 13 | DDS release status: tags to v3.1.1 (A) vs latest release 3.1.0 (C) | **Both confirmed** | Tags: v3.1.1, v3.1.0, v3.0.0. Releases: v3.1.0 (2026-08-19), v3.0.0 (2026-05-18) |
| 14 | DDS WebAssembly needs 256 MB initial memory, an 8 MB stack and 8 threads, and ships no reusable library build (A, B, C) | **Confirmed** | `docs/wasm_build.md` lines 156–158 and 201 |
| 15 | bridge-dds `dist/api.js` uses ESM imports without `"type":"module"` (A) | **Confirmed** | npm 1.4.0 has `main ./dist/api.js` and no `type`; contains `import DdsLoader from "./lib/dds"` |
| 16 | The bridge-tools solver package is only "planned" (C) | **Out of date** | `@bridge-tools/dd` 0.2.2 and `@bridge-tools/core` 0.3.1 are on npm, from `aaron-hutton/bridge-tools`; `bridge-tools/core` is archived at 0.0.8 |
| 17 | ts-contractbridge is MIT (A) / only its core package is MIT (C) | **C is right** | Repository licence is null; not on npm |
| 18 | GNUBridge robots see all hands (A) | **Confirmed** | `DealController.java`, search worker: `new DoubleDummySolver(game)` |
| 19 | GNUBridge's tests expect wrong scores (C) | **Confirmed**, plus one more | Tests expect `500 + 6*30` for 6♠ and `110` for 1♥ doubled; also `1000 + 7*20` for 7♣ (missing the game bonus) |
| 20 | kduffie scores 2♥ doubled as 110 instead of 470 (C) | **Confirmed by reading the code** | `contract.ts` `getScore`: no doubling multiplier, no bonus for making a doubled contract, game bonus ignores doubling |
| 21 | Bridgit's history explanation methods are unimplemented (C) | **Confirmed** | `BridgeBidder.cs` lines 71–78 throw `NotImplementedException` |
| 22 | BEN's default config consults BBA (C) | **Confirmed** | `default_api.conf`: `use_bba=False`, `consult_bba=True`, `use_bba_rollout=True`, `use_bba_to_count_aces=True` |
| 23 | saycbridge: 46 commits in 2026 (A) | **Approximately right** | 48 since 2026-01-01: 43 "Claude Code sessions", 5 Andrew Bortz |
| 24 | Nickel Bridge has no licence for its own code (B, C) | **Confirmed** | The only licence file in the tree is `packages/ai/vendor/bridge-dds/LICENSE` |
| 25 | Nickel Bridge grading thresholds are 60/20/5% (C) | **Confirmed** | `bidder.ts` lines 36–38 |
| 26 | maxgiraldo/playbridge's deal logic differs from EBU, and its solver has limits (B) | **Confirmed** | `game.py:168` (`ns_hcp >= ew_hcp`), lines 170–175; `dds.py:22` (`NODE_LIMIT = 40_000`), line 141 (more than 24 cards skipped), lines 162–168 (HCP estimate) |
| 27 | EBU MiniBridge baseline (B) | **Confirmed** | EBU "11 easy steps": redeal at 20:20, tie goes to the first to announce, dummy is shown before the contract is chosen |
| 28 | BBO figures for ACBL-Ben vs GIB (A) | **Quotes confirmed; relevance limited** | 48.41/49.21 vs 55.93/50.87; defence 49.3 vs 50.8; contracts bought 53% vs 50%; this is a different variant, in 2024 |
| 29 | A's search coverage | **Gaps found; not all decision-relevant** | `gh search repos` today: A's "contract bridge" query ranks Nickel Bridge #76 (unlicensed). Queries A did not list find others: "bridge card game" ranks bridge-game-coach #83 and "bridge bidding engine" ranks rusty-bidding-bot #3. Bridge-Classroom is not in the top 100 for any query I tried |
| 30 | BridgeZ licence is null on GitHub but its README grants GPLv3 (C) | **Confirmed** | README line 14 |
| 31 | C's companion evidence files exist | **Refuted** | None of the 9 files is in the repository |

---

## 9. Recommendations

### 9.1 Owner decisions to make before any further research

These decisions change which report's recommendations apply. All three reports defer to them.

1. **Is the product MiniBridge first?** If yes, B's rules layer and acceptance table are the critical path, and bidding engines move to phase 2.
2. **Which bidding system do beginners learn?** 2/1 points to rusty-bidding-bot versus pons `american_instinct()`. SAYC points to saycbridge. Acol or a custom system means authoring our own rules.
3. **How will the product be distributed:** commercial or not, closed or open source, hosted service or shipped binaries? This decides whether BEN, the GPL components and anything derived from EPBot are usable.
4. **Is a backend acceptable?** This decides whether BEN, saycbridge, Bridgit and native DDS are practical.

### 9.2 Errata to apply to the reports

- **A:** narrow the "no teaching base" headline to the coach, add Bridge-Classroom, and keep an exclusion log (A1); correct the pons claims and its row in the commercial-use table (A2); qualify "verified in the browser" (A3); fix the coaching-table legend and the "strongest robot tested" wording (A4); fix the redeal, Bridge-Package, macroxue and ts-contractbridge entries, and mark eBridge's licence as unclear (A5); reconcile the counts, restore the diagram and pin the links (A6).
- **B:** downgrade kduffie/bridge-engine to reference only (B3); use default-branch commit dates and note eBridge's ISC declaration (B4); add a note that the scope differs from the companion reports (B1).
- **C:** re-assess the current `@bridge-tools` packages (C1); add macroxue/bridge-solver (C2); give the reason for the 9-file Bridge-Classroom selection or run the full suite (C3); commit the evidence files or remove the references to them (C4); add GNUBridge's information leak (C6); fix the spacing and remove the "lane" vocabulary (C5, C7).

### 9.3 Combined validation plan

This plan combines the best of A §"Smallest validation steps", B's acceptance table and C §7. Run the items after the decisions in §9.1. Time boxes are indicative.

| # | Experiment | Time box | Pass criterion |
|---|---|---|---|
| 1 | **Licence and bill-of-materials gate.** Bridge-Classroom with BBA disabled; pons `american_instinct()` built with no `american_bba_*` weights (inspect the built artefact); BEN only if the BBA/BGA/SuitC terms are resolved; DDS and `coi-serviceworker.js` notices | ½ day, plus waiting on replies | Every shipped file has a confirmed licence and its required notices |
| 2 | **Double-dummy performance on phones.** bridge-dds, macroxue and DDS 3.1 (single-threaded, plus threaded behind COOP/COEP), on one low-end Android phone and one iPhone, using A's 100 deals **plus positions in the middle of a trick** | 1 day | Per-card solve under 1 s at the 95th percentile, defined behaviour on hard-deal timeouts, no crashes, peak memory recorded |
| 3 | **Bridge-Classroom spike.** Full unit suite at the cited commit; production build with the real Rusty WebAssembly and BBA disabled; one Baker lesson end to end; confirm the two Baker defects are caught or fixed | 2 days | Suite green; lesson plays offline; no silent fallback to BBA |
| 4 | **Explanation comparison.** rusty-bidding-bot versus pons `american_instinct()` (or saycbridge or Bridgit, depending on the system) on 30 auctions reviewed by a bridge teacher, including a valid alternative bid, a forcing auction and a case no rule covers | 2–3 days, plus 1 teacher-day | Every call traces to a rule; the uncovered case is reported as unsupported, not as Pass; teacher grades accuracy and clarity |
| 5 | **Information-boundary test harness.** B's test: swap hidden cards while keeping public information fixed, and check that advice and robot moves do not change. Make it a permanent automated test | 1 day | No dependence on hidden cards in modes restricted to what the player can see |
| 6 | **Fair-feedback study.** A's comparison: double-dummy versus single-dummy cost on 30 beginner deals | 2 days | Count how often double-dummy alone would blame a correct play; this sizes the single-dummy work |
| 7 | **Re-scan the landscape just before committing.** Use the union of the three reports' queries, and log why each candidate is excluded | ½ day | No new candidate that changes a decision, or the decision is revisited |

### 9.4 Housekeeping

- Keep **one candidate register**: the union of the three reports' candidates, with confirmed licences, default-branch commit dates and full-hash links. Three tables that disagree will keep producing contradictions.
- Commit the test scripts and evidence files next to the reports (A's test log scripts, C's nine companion files), so that tested claims can be re-run.
- Name collision: `maxgiraldo/playbridge` ("Contract bridge and MiniBridge table…", created 2026-09-10, no licence) shares this repository's name in the same domain. Check this before publishing under the name.
