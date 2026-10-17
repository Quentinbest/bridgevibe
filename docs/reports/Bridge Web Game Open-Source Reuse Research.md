# Bridge Web Game: Open-Source Reuse Research

Oct 17, 2026 · @Kun Donald

## Summary

**No open-source bridge game is suitable as a foundation.** Several engines are suitable for partial reuse inside a new Web application. The teaching layer (tutorials, rules explanations, coach) has no reusable open-source base and must be built.

- **Double-dummy analysis in the browser is solved and verified.** DDS compiled to WASM (`bridge-dds`, Apache-2.0) matched native DDS on 100/100 deals and on per-card analysis. An independent solver (macroxue, MIT/Apache, 72 KB WASM) also matched 100/100. DDS 3.1 now ships an official WASM build. This is the basis for "this card cost you a trick" feedback.
- **Bid explanations are the deciding factor, and they depend on the bidding system.** For 2/1, pons (Apache-2.0, Rust to WASM, 1,486 passing tests) attaches readable constraints to every bid. For SAYC, saycbridge (BSD, 89.3% of the SAYC booklet) does similar work on a server. For any other system, no reusable explainer was found.
- **Playing strength and coaching usefulness come from different engines.** BEN (GPL-3.0, server-side) is the strongest open robot tested, but its explanations come from EPBot, a closed binary with no license. Double-dummy alone teaches hindsight; fair card-play coaching needs single-dummy sampling.
- **Rejected after testing or inspection:** `@bridge-tools/dd` (wrong results on repeated calls), GNUBridge (robots see all hands), eBridge and rajnesh (no license), EPBot (no license), LibreBridge (incomplete). redouble (2019) is kept as a reference only.

**Recommended direction:** a browser-first app that reuses DDS WASM and, if the system is 2/1, pons, with our own TS rules core, lessons, and coach. Add a server (BEN robots, LLM phrasing, multiplayer) only when a requirement proves the need. **Before committing,** choose the beginner bidding system and run the five short validation checks listed near the end (mobile DD performance, bidding-engine spike, teacher review, fair-feedback check, license and maintainer check).

## Search method

The search found about 450 bridge-related repositories. 26 were cloned for inspection and 4 were run. Coverage is broad for GitHub and English-language package registries and thin elsewhere. It is not exhaustive.

| Source | Queries / method | Raw results | Notes |
| --- | --- | --- | --- |
| GitHub repo search (`gh search repos`) | 35 English terms, e.g. *contract bridge*, *double dummy solver*, *bridge bidding*, *bridge bot*, *bridge trainer*, *bridge coach*, *bridge wasm*, *sayc*, *acol*, *pbn*, *bridge reinforcement learning*; up to 100 results each | 1,182 unique repos | "bridge" is very noisy (network, crypto, MCP bridges) |
| GitHub topics | `contract-bridge`, `bridge-game`, `double-dummy`, `bridge-bidding`, `bridge-solver`, `dds`, `bridge-card-game` | included above | `dds` topic is mostly Data Distribution Service noise |
| Relevance filter | Regex on name + description for card-bridge vocabulary, then manual triage | 449 repos | Triage by function, license, activity, size |
| Non-English GitHub | *桥牌*, *brydż/brydz*, *bridge enchères*, *bridge bieden/reizen*, *Bridge Reizung*, *licytacja* | \~70 repos | Mostly scoring apps and student projects; nothing new for the shortlist |
| LLM-specific GitHub | *contract bridge LLM*, *bridge GPT bidding*, *bridge explain bid* | 0 relevant | No open-source LLM bridge coach found |
| npm | *contract bridge*, *bridge dds*, *double dummy*, *pbn bridge*, *bridge bidding*, *bridge-tools* | 8 relevant packages | Found `bridge-dds`, `@bridge-tools/dd`, `contract-bridge` |
| PyPI | Named lookups (endplay, ddstable, bridgeobjects, bridgebots, redeal) | 5 packages |  |
| Web search | 9 queries: WASM DDS, bidding engines with explanations, SourceForge, teaching software, BEN strength, Bridgit, LLM coach, GitLab/Codeberg, Zbridge | \~80 pages | Found Bridgit, Bridge Solver Online, PyBridge, FreeBridge, arXiv 2406.10306 |
| Known-project lookups | Direct API checks of \~45 repos named in the literature or forums | 45 | Caught DDS, BEN, saycbridge, OpenSpiel, which keyword search ranked low |

**Stopping rationale.** Searching stopped when new queries returned only repos already triaged, student projects, or scoring-only apps. The last 15 queries (non-English, LLM, Bridgit) added one shortlist candidate (Bridgit). Further GitHub keyword variants were judged unlikely to change the recommendation.

**Known gaps.**

- GitLab, Codeberg, Gitee and Bitbucket were covered only through web search, not native search.
- SourceForge projects (PyBridge, FreeBridge) were identified but not cloned; both are inactive desktop apps.
- Closed products (BBO GIB/GIBBO, WBridge5, Funbridge, IntoBridge "Coach Luc", Zbridge, ACBL Learn to Play) are out of scope for reuse; they appear only as benchmarks.
- Repositories with no description or non-English names may have been missed by the relevance filter.
- Academic code was checked for three papers only (BEN, arXiv 2406.10306 / brl, Facebook JPS).

## Evidence conventions

Every reuse judgment in this report is tagged with the strongest evidence behind it. Popularity (stars, forks) is recorded but never used as evidence of quality.

| Tag | Meaning | What it can support |
| --- | --- | --- |
| **\[D\] Documented** | Stated in a README, wiki, paper or website; not checked | Feature existence claims only, flagged as unverified |
| **\[I\] Inspected** | Source code, license file, tests or build files read at a cited path/commit | Architecture, license, browser-vs-backend, presence of tests |
| **\[T\] Tested** | Cloned, built and/or run locally in this session; logs in the Appendix | Builds, runs, passes its own tests, produces sane output |

Maintenance status uses the date of the last commit on the default branch, read from the GitHub API on 2026-10-17. "Active" = commit within 12 months; "Dormant" = 1–3 years; "Abandoned" = over 3 years.

## Candidate comparison

No complete open-source bridge game is suitable as the product foundation. Several components are suitable for partial reuse, especially double-dummy analysis in the browser and an authored bidding system with machine-readable meanings. 26 candidates are listed below, grouped by the role they could play. Commit dates are from the GitHub API on 2026-10-17.

**Classes:** **F** = foundation · **P** = partial reuse · **R** = reference only · **U** = unsuitable or insufficiently verified.

| Project | Role | License | Last commit | Runs in browser? | Best evidence | Class |
| --- | --- | --- | --- | --- | --- | --- |
| [dds-bridge/dds](https://github.com/dds-bridge/dds) (DDS 3.1) | Double-dummy (DD) solver, C++ | Apache-2.0 | 2026-10-16 | Yes: official WASM build; threads need cross-origin isolation | \[T\] official demo solved a deal in 71 ms | **P** |
| [bookchris/bridge-dds-js](https://github.com/bookchris/bridge-dds-js) (npm `bridge-dds` 1.4.0) | DDS compiled to WASM + TS API | Apache-2.0 | 2025-05-22 | Yes, single-threaded | \[T\] 100/100 DD tables and 10/10 per-card lead analyses match native DDS | **P** |
| [macroxue/bridge-solver](https://github.com/macroxue/bridge-solver) | Independent DD solver + web app | MIT or Apache-2.0 | 2026-10-03 | Yes, 72 KB WASM | \[T\] 100/100 DD tables match DDS; own tests pass; web app solved in 732 ms | **P** |
| [aaron-hutton/bridge-tools](https://github.com/aaron-hutton/bridge-tools) (`@bridge-tools/dd`, `/core`) | DDS WASM wrapper + TS rules utilities | MIT | 2025-05-17 | Yes | \[T\] `dd` returns wrong values and cards not in hand on repeated calls | **U** (dd) / **R** (core) |
| [jdh8/pons](https://github.com/jdh8/pons) | 2/1 bidding system, hand evaluation, practice UI; Rust | Apache-2.0 | 2026-10-16 | Yes (Rust to WASM; pure-Rust DD) | \[T\] 1,486 tests pass; 36,678-line readable system book generated | **P** |
| [eseidel/saycbridge](https://github.com/eseidel/saycbridge) | SAYC bidder with rule tracing; Python + Z3 | BSD-3-Clause | 2026-08-29 | No (Python backend) | \[T\] 1,325 of 1,483 SAYC test hands pass (89.3%) | **P** (SAYC only) |
| [TricksterCards/Bridgit](https://github.com/TricksterCards/Bridgit) | 2/1 bidder (LC Standard subset) with call annotations; C# | MIT | 2025-09-11 | No (.NET backend, or port) | \[I\] 67 PBN test files; not run (no .NET here) | **P** (conditional) |
| [RalphLipe/ts-contractbridge](https://github.com/RalphLipe/ts-contractbridge) | TS data model: cards, calls, contracts, PBN, matchpoints | MIT | 2026-09-24 | Yes | \[T\] 563/563 tests pass; not yet on npm | **P** |
| [lorserker/ben](https://github.com/lorserker/ben) | Neural bidding + card-play robot, REST API | GPL-3.0 (+ proprietary binaries) | 2026-10-11 | No (Python 3.12, TensorFlow; 240 MB models) | \[T\] API bid in 0.06 s, opening lead in 1.8 s with ranked alternatives | **P** (backend opponent) |
| [EdwardPiwowar/BBA](https://github.com/EdwardPiwowar/BBA) (EPBot) | Bidding engine binaries with explanations | None (freeware) | 2026-05-15 | No (native libs) | \[I\] README: "No explicit license" | **U** |
| [dominicprice/endplay](https://github.com/dominicprice/endplay) | Python dealer, DDS bindings, PBN/LIN parsers | MIT | 2025-03-21 | No | \[T\] generated 100 deals and DD tables | **P** (offline tooling) |
| [anntzer/redeal](https://github.com/anntzer/redeal) | Python constrained dealer | Unclear (NOASSERTION) | 2025-10-16 | No | \[D\] | **R** |
| [harukaki/brl](https://github.com/harukaki/brl) | RL bidding research (arXiv 2406.10306) | Apache-2.0 | 2024-06-03 | No (JAX) | \[D\] +1.24 IMPs/board vs WBridge5 | **R** |
| [google-deepmind/open\_spiel](https://github.com/google-deepmind/open_spiel) bridge | Research environment | Apache-2.0 | 2026-08-31 | No | \[I\] `games/bridge/` uses DDS for scoring | **R** |
| [macroxue/bridge-bidding-practice](https://github.com/macroxue/bridge-bidding-practice) | Browser bidding practice (bid all four hands) + DD analysis | GPL-3.0 | 2026-09-27 | Yes | \[I\] static HTML + WASM; \[D\] demo | **R** (UX) |
| [frankwallis/redouble](https://github.com/frankwallis/redouble) | Complete web game, React/Koa | MIT | 2019-04-09 | Partly (DDS via Node server) | \[I\] Babel 6 / Webpack 1-era stack | **R** |
| [pslusarz/gnubridge](https://github.com/pslusarz/gnubridge) | Desktop game, Java Swing | GPL-3.0 | 2025-04-05 | No | \[I\] AI runs DD search on the real deal (sees all hands); 23 bidding rules | **R** |
| [juef17/LibreBridge](https://github.com/juef17/LibreBridge) | Desktop game, Qt | GPL-3.0 | 2026-06-10 | No | \[D\] random-playing AI; GUI not playable | **U** |
| [ebridge/bridge-web](https://github.com/ebridge/bridge-web) | Multiplayer web platform | None | 2021-03-31 | Yes (Next.js + Express) | \[I\] no LICENSE file | **U** |
| [rajnesh/bridge-bidding-system-js](https://github.com/rajnesh/bridge-bidding-system-js) | Browser SAYC bidder + play tab | None | 2025-12-28 | Yes | \[I\] no LICENSE file | **U** |
| [hdkz-dev/multi-game-engines](https://github.com/hdkz-dev/multi-game-engines) | Adapter to external GIB-protocol engines | MIT | 2026-10-17 | Yes | \[I\] no bridge engine of its own | **U** |
| [jfklorenz/Bridge-Package](https://github.com/jfklorenz/Bridge-Package) (npm `contract-bridge`) | Scoring, movements | MIT | 2023-01-04 | Yes | \[D\] | **R** |
| [richardschneider/bridge](https://github.com/richardschneider/bridge), [bridge-scorer](https://github.com/richardschneider/bridge-scorer) | JS model + duplicate scoring | MIT | 2020-05-24 | Yes | \[D\] | **R** |
| [Kungsgeten/bml](https://github.com/Kungsgeten/bml) | Markup for bidding-system notes | MIT | 2020-05-26 | n/a | \[D\] | **R** |
| [BSalita/SH\_Bidding](https://github.com/BSalita/SH_Bidding) | Research notes and data pipelines | MIT | 2026-07-16 | No | \[D\] "no end-user components" | **R** |
| PyBridge, FreeBridge (SourceForge) | Desktop clients | GPL | pre-2015 | No | \[D\] | **U** |

The main gap is that no open-source project offers tutorials, lessons, or a coach that explains mistakes in plain language. These must be built.

## Detailed shortlist assessment

Seven projects were shortlisted for partial reuse. Each assessment gives the inspected commit, so findings can be re-checked.

### 1. DDS 3.1 — double-dummy engine (P)

[dds-bridge/dds](https://github.com/dds-bridge/dds) @ `a3adeec` (default branch \`develop\`; links point to \`main\`)

- **Function.** The reference double-dummy solver since 2006. It computes trick tables, par scores, best cards (`SolveBoard`) and play analysis (`AnalysePlay`). Version 3 is a C++ modernization by Martin Nygren (README, May 2026). \[I\]
- **Web fit.** An official WASM build and browser demo ship in [`web/`](https://github.com/dds-bridge/dds/tree/main/web), with CI in [`ci_wasm.yml`](https://github.com/dds-bridge/dds/blob/main/.github/workflows/ci_wasm.yml) and Playwright end-to-end tests. The pthread build needs `SharedArrayBuffer`, which requires COOP/COEP headers or the bundled `coi-serviceworker.js`. \[I\] [`docs/wasm_build.md`](https://github.com/dds-bridge/dds/blob/main/docs/wasm_build.md) sets `INITIAL_MEMORY` to 256 MB and an 8 MB stack. That may be a problem on low-memory phones. \[I\]
- **Tested.** The [live demo](https://dds-bridge.github.io/dds/) was cross-origin isolated in headless Chromium and solved a sample deal in 71 ms. \[T\]
- **Maintenance and tests.** Active: commits on 2026-10-16, tags v3.0.0 to v3.1.1, Bazel builds on 3 OSes, plus .NET, Java and Python bindings. Builds use Bazel and LLVM 21 (about 5 GB). \[I\]
- **License.** Apache-2.0. It allows commercial use, with NOTICE preserved.
- **Limitations.** It is an analysis engine, not a player. Perfect-information results can mislead beginners unless they are framed carefully (see the coaching section).

### 2. bridge-dds (npm) — ready-made DDS WASM package (P)

[bookchris/bridge-dds-js](https://github.com/bookchris/bridge-dds-js) @ `23c7242`, npm 1.4.0

- **Function.** A thin TS wrapper over DDS 2.9 compiled to WASM. It exposes `CalcDDTablePBN`, `SolveBoardPBN`, `AnalysePlayPBN` and `DealerPar`. \[I\]
- **Tested.** It matched native DDS (via endplay) on 100/100 random DD tables and on 10/10 per-card opening-lead analyses. The median was 121 ms per full table and the maximum 2.2 s, single-threaded in Node 18. \[T\]
- **Defects found.** The published `dist/api.js` uses ESM syntax without `"type":"module"` and has an extensionless import, so it loads only through a bundler. \[T\] The DDS fork it builds from was an unmerged PR ([dds#118](https://github.com/dds-bridge/dds/pull/118)). \[D\]
- **Maintenance.** One maintainer; last release 2025-05. Risky as a long-term dependency, but small enough to vendor or rebuild from DDS 3.1.

### 3. macroxue/bridge-solver — alternative DD engine and play-out UI (P)

[macroxue/bridge-solver](https://github.com/macroxue/bridge-solver) @ `630705d`

- **Function.** An independent C++ DD solver with a client-side [web app](https://macroxue.github.io/bridge-solver/web/). The app offers DD tables, par, single-dummy shuffles, and play-out showing the trick cost of each card (`=`, `+`, `-N`). \[I\]
- **Tested.** The native build passed `make test`. It matched DDS on 100/100 random deals in about 0.1 s each. The hosted web app solved a random deal in 732 ms in headless Chromium. \[T\]
- **Web fit.** The WASM is 72 KB (plus a no-SIMD fallback) and runs in a Web Worker. The README documents reusing `solver.js`/`solver.wasm` through the `worker.js` protocol. \[I\]
- **License.** Dual MIT / Apache-2.0. Single maintainer, 55 commits, active in 2026-10.
- **Limitations.** Its API is a worker message protocol, not a library API. It has no par-by-contract `AnalysePlay` equivalent; per-card evaluation exists only inside play-out.

### 4. pons — 2/1 bidding system with readable meanings (P, strongest bidding candidate)

[jdh8/pons](https://github.com/jdh8/pons) @ `a9362f9`

- **Function.** A Rust library with an authored 2/1 game-forcing bidding system. Each node holds rules with weights and constraints, and the constraints carry their own English descriptions. It also has hand evaluators (HCP, NLTC, Zar), Monte-Carlo single-dummy estimation and lead selection ([`src/single_dummy.rs`](https://github.com/jdh8/pons/blob/main/src/single_dummy.rs)), and a BBA/EPBot benchmark harness. \[I\]
- **Tested.** All 1,486 library and integration tests passed (`cargo test --release`). `render-book` produced a 36,678-line readable book, e.g. "1NT — 15–17 HCP, and balanced or 5m(422)/6m(322) 1NT shape". \[T\]
- **Web fit.** [`web/`](https://github.com/jdh8/pons/tree/main/web) builds a WASM front end with practice, demo, book, odds and partner tabs, and a pure-Rust DD solver. The [hosted app](https://jdh8.github.io/pons/) loaded with no console errors, but pressing Deal produced no deal within 15 s in headless Chromium. Result: inconclusive. \[T\]
- **Maintenance.** Very active: 1,661 commits since 2023-03 by one author, with substantial AI-agent assistance (`AGENTS.md`, `CLAUDE.md`). Version 0.12.0-dev, so the API is still unstable.
- **License.** Apache-2.0. The vendored EPBot is benchmark-only and excluded from the crate.
- **Limitations.** 2/1 only. Explanations are terse and use jargon ("fifths", "UP", weights), so a beginner-facing language layer is needed. It has no card-play bot for interactive play. Bus factor is 1.

### 5. saycbridge — SAYC bidder with rule tracing (P if SAYC; otherwise R)

[eseidel/saycbridge](https://github.com/eseidel/saycbridge) @ `6d5c1c0`

- **Function.** It bids SAYC with about 207 named rules expressed as Z3 constraints. Every call maps to a rule and to point and shape constraints. \[I\]
- **Tested.** `scripts/test-sayc` passed 1,325 of 1,483 hands from the SAYC booklet (89.3%) in 8 s, matching the committed baseline. `scripts/explain 1N P 2C` printed the rule trace and resulting constraints. The output is developer-level: it lists every rule that failed and shows loose ranges (responder 0–15 points). \[T\]
- **Maintenance.** The README says "not currently maintained (for almost a decade)". However, 46 commits landed in 2026 (by Andrew Bortz, with Claude Code sessions), raising the pass rate. Status is uncertain. \[I\]
- **Web fit.** Python + Z3, so it needs a server. Z3 has a WASM build, but running this bidder in the browser is unverified.
- **License.** BSD-3-Clause.

### 6. Bridgit + ts-contractbridge — 2/1 bidder and TS data model (P, conditional)

[TricksterCards/Bridgit](https://github.com/TricksterCards/Bridgit) @ `ee9ade9`; [RalphLipe/ts-contractbridge](https://github.com/RalphLipe/ts-contractbridge) @ `8a788cf`

- **Function.** Bridgit bids a subset of LC Standard 2/1 and powers Trickster Cards' 2/1 option ([Trickster help page](https://bridge.trickstercards.com/help/two-over-one-preview/)). It has `CallAnnotation`/`CallDetails` types for explanations. \[I\] ts-contractbridge is the author's new TS library for cards, calls, contracts, PBN (including auction and play sections) and matchpoints. \[I\]
- **Tested.** ts-contractbridge: 563/563 Vitest tests passed. \[T\] Bridgit was not run (no .NET SDK here); its suite is 67 PBN files. \[I\]
- **Web fit.** Bridgit targets .NET Standard 2.0, so it needs a .NET service or a port. Project notes mention a "bridgit-ts" port that is not public. \[I\]
- **Maintenance.** Bridgit's last commit is 2025-09; ts-contractbridge is active (2026-09) but not yet on npm. Both are MIT.

### 7. BEN — strongest open robot, server-side only (P as opponent/analysis backend)

[lorserker/ben](https://github.com/lorserker/ben) @ `72653ec`

- **Function.** Neural-network bidding plus card play with DDS-based simulation. It offers a REST API (`/bid`, `/lead`, `/play`, `/explain`, `/explain_auction`) and selectable systems (21GF-GIB, 21GF, SAYC). \[I\] [`README-api.md`](https://github.com/lorserker/ben/blob/main/README-api.md)
- **Tested.** It ran natively on macOS arm64 with Python 3.12 and TensorFlow 2.18.1. `/bid` returned 2♣ Stayman in 0.06 s. `/lead` returned ♠Q in 1.8 s with ranked alternatives (make probability, expected IMPs). \[T\]
- **Coaching caveat.** Bid explanations come from EPBot ([`src/bba/BBA.py`](https://github.com/lorserker/ben/blob/main/src/bba/BBA.py)), a closed binary with no license. `/explain_auction` returned labels such as "bidable suit" and "calculated bid". The README lists "can't use or interpret defensive signals". \[I\] \[T\]
- **Strength.** No independent benchmark. BBO's own data for its ACBL-Ben variant: 48.4% vs GIB 55.9% on suit-contract declarer play ([BBO News](https://news.bridgebase.com/?p=28455)). \[D\]
- **License.** GPL-3.0. It also bundles proprietary binaries (EPBot, BGA/PIMC DLLs) whose redistribution terms are unclear. Using it as a separate network service avoids linking GPL code into the web client.

### Notable rejections

- **`@bridge-tools/dd` 0.2.2.** Repeated calls in one process returned up to 20 cards for a 13-card hand, with wrong trick values in 5 of 10 deals. The npm package also misplaces `compiled.wasm`. \[T\]
- **GNUBridge.** [`DealController.java:99`](https://github.com/pslusarz/gnubridge/blob/master/src/main/java/org/gnubridge/presentation/gui/DealController.java) runs the DD solver on the real game, so its robots see all hands. That makes it unusable as a teaching model. \[I\]
- **EPBot/BBA.** It has the most complete bid explanations seen, but no license ("contact the repository owner"). The pons README says it is free for non-commercial use only. \[I\]

## AI playing strength vs coaching usefulness

No candidate is both a strong player and a good teacher. The strongest open robot (BEN) explains least, and the best explainers (pons, saycbridge) cannot play the cards. A coach therefore has to be assembled from separate parts.

A useful coach must answer six questions about a learner's action. The table shows which candidates supply each answer. "Yes" means tested here, "Partly" means present but needing work, and a blank means absent.

| Coaching need | DDS / bridge-dds / macroxue | pons | saycbridge | Bridgit | BEN |
| --- | --- | --- | --- | --- | --- |
| 1. What was the best action? (strength) | Yes, but perfect-information only | Bidding: yes (2/1) | Bidding: yes (SAYC, 89% of booklet) | Bidding: claimed (2/1 subset) | Bidding and play: yes |
| 2. How much did my action cost? | Yes: exact tricks per card | Partly: single-dummy estimates |  |  | Partly: candidate scores per bid and lead |
| 3. What does each bid mean in our system? |  | Yes: constraint text per rule | Partly: constraint dump | Partly: call annotations | Only via closed EPBot |
| 4. Is the judgment fair to what the player could see? | No: sees all 52 cards | Yes: samples hidden hands | n/a (bidding) | n/a | Yes: simulation over samples |
| 5. Is it in beginner language? |  | Jargon-heavy | Developer output | Not verified | Short labels |
| 6. Does it match the system being taught? | n/a | Only if teaching 2/1 | Only if teaching SAYC | Only if teaching 2/1 | Partly: robot plays its own learned style |

**Three implications for design.**

1. **Double-dummy is a grader, not a tutor.** It answers "how many tricks did this card cost with all cards visible" exactly and fast in the browser. Shown raw, it teaches hindsight. A beginner who finesses correctly and loses to a bad split is told they "lost a trick". Coaching on card play needs single-dummy sampling (sample hidden hands consistent with the auction and play, then solve each double-dummy). pons and BEN implement this; it can be rebuilt on DDS WASM.
2. **Bid explanations should come from the same rules the robots bid with.** pons and saycbridge make this possible because every call is chosen by a named rule with explicit constraints. A coach can then say "partner's 1NT showed 15–17 balanced, you have 9, so invite" and be consistent with the robot partner. BEN's network cannot do this itself; it borrows EPBot's text.
3. **A language model should phrase, not judge.** No open-source LLM bridge coach was found (searches: *contract bridge LLM*, *bridge GPT bidding*, *bridge explain bid*). If an LLM is used, it should rewrite verified engine facts (rule constraints, trick costs, sampled probabilities) into beginner language. It should never be the source of a bridge claim. Closed commercial products already advertise AI bidding feedback (e.g. IntoBridge "Coach Luc"; seen in search results only, not examined).

## Recommended reuse approach

**Recommendation: build our own Web application, and reuse open-source engines inside it.** Do not fork a complete game. Every complete game found is outdated, desktop-only, unlicensed, or has robots that cheat. Reuse two engine families that were verified here: double-dummy analysis compiled to WebAssembly, and an authored bidding system with machine-readable meanings. Build the teaching layer (lessons, rules explanations, coach) ourselves, because nothing reusable exists.

&#91;embedded content: proposed reuse architecture · browser-first, optional server\]

Everything inside the shaded area runs in the browser with no server. Server pieces are added only if a later requirement proves the need.

### Mapping to the four product requirements

| Requirement | Reuse | Build | Why |
| --- | --- | --- | --- |
| **Web** | DDS via WASM: start with the tested `bridge-dds` build, move to an official DDS 3.1 WASM build after the memory check. macroxue/bridge-solver (72 KB) is the fallback. pons compiles to WASM. | TS rules core, UI | All three engines were run or built for the browser; no complete web game is reusable. |
| **Beginner tutorials** | endplay (MIT, offline) to generate practice deals that fit each lesson; DDS to check each deal teaches its point | Lesson content, lesson player | No open-source lesson content was found. |
| **Rules explanations** | Bid meanings from pons constraint text (2/1) or saycbridge rules (SAYC) | Beginner wording; play and scoring rules text | Explanations then stay consistent with how the robots bid. |
| **AI coach** | DDS per-card trick cost; single-dummy sampling (pattern from pons `single_dummy.rs`); optionally BEN candidate scores | Coach facts layer, feedback templates, optional LLM phrasing with fact checks | No open coach exists. Strength and explanation come from different engines. |

### How open decisions change the recommendation

| Open decision | If… | Then… |
| --- | --- | --- |
| **Bidding system** | 2/1 game forcing | pons is the bidding engine and explanation source; Bridgit is the second option. |
|  | SAYC | saycbridge (BSD) on a small Python server, or port its rules to TS. Treat the 89% booklet pass rate as the quality floor. |
|  | Acol, Precision or a custom beginner system | No reusable explainer was found. Author rule tables ourselves, using the pons rule-and-constraint design as the reference. |
| **Commercial use** | Yes | MIT, BSD and Apache components are fine with notices. Keep GPL-3.0 code (BEN, GNUBridge, macroxue/bridge-bidding-practice) out of the shipped browser bundle; BEN only as a separate service. Exclude EPBot (no license; reportedly non-commercial only). BEN's bundled binaries need legal review. |
|  | No (hobby or education) | GPL components become usable in the client too; EPBot may still be excluded for redistribution reasons. |
| **Skill levels beyond beginner** | Intermediate players | Single-dummy coaching becomes essential and robot strength matters more. Plan the optional BEN service. |
| **Multiplayer** | Needed | No shortlisted project helps. Write the rules core in TS so the same code validates moves on a server. eBridge (no license) and redouble (2019) are references only. |
| **Budget** | Minimal hosting | The browser-only path has no per-user compute. BEN and LLM add server and inference cost. |
| **Technology** | Any frontend framework | The engines are framework-neutral (WASM in Web Workers). A .NET backend would only be needed for Bridgit. |

## Remaining gaps and validation steps

The engine choices are well evidenced on a desktop machine. Mobile behavior, teaching quality, and long-term maintainer risk are not yet evidenced. One decision and five checks of half a day to three days each would settle the direction before any product code is written.

### What this research did not establish

- **Mobile performance.** All tests ran on an Apple Silicon Mac. DDS 3.1's WASM build asks for 256 MB initial memory; behavior on low-end Android and iOS Safari is unknown.
- **Teaching quality.** No bridge teacher reviewed any explanation. Judgments about "beginner language" are the researcher's, not an expert's.
- **Playing strength.** No independent head-to-head numbers exist for BEN, pons, Bridgit or saycbridge. The only figures are self-reported (brl vs WBridge5) or vendor data (BBO's ACBL-Ben vs GIB).
- **Unrun candidates.** Bridgit was not run (no .NET SDK). The pons web app did not deal in headless Chromium; a manual check is needed.
- **Maintainer risk.** pons, macroxue/bridge-solver, bridge-dds and ts-contractbridge each have one maintainer. Several (DDS 3, pons, saycbridge's 2026 revival, ts-contractbridge) are developed heavily with AI coding agents, which raises velocity and also review risk.
- **Search coverage.** See Search method: GitLab, Codeberg and Gitee were not natively searched.

### Smallest validation steps, in order

- [ ] **Choose the bidding system for beginners (decision, not research).** It gates the bidding-engine spike and the teacher review. 2/1 → pons/Bridgit; SAYC → saycbridge; anything else → author our own rules.
- [ ] **Mobile DD spike (1 day).** Load `bridge-dds` and macroxue's `solver.wasm` in a Web Worker on one low-end Android phone and one iPhone. Measure load time, time per DD table, per-card solve time, and peak memory on the same 100 deals used here. Repeat for a DDS 3.1 threaded build behind COOP/COEP headers. Pass: under 1 s per per-card solve, no crashes.
- [ ] **Bidding-engine spike (2–3 days).** Build `pons/web`, call the bidder from a plain JS page, and bid 100 random deals. Export the explanation for the 30 most common beginner auctions. Pass: every call has a rule and constraint text; no crashes. (For SAYC: run saycbridge as a small HTTP service and do the same.)
- [ ] **Teacher review of explanations (1 day of a qualified teacher's time).** Rewrite the 30 auctions' constraints into beginner sentences and ask a bridge teacher to grade accuracy and clarity. This tests whether rule constraints can carry rules explanations.
- [ ] **Fair-feedback check for card play (2 days).** On 30 beginner deals, compare double-dummy trick cost against single-dummy sampled cost for declarer's key decisions. Count how often double-dummy alone would blame a correct play. This decides how much single-dummy work the coach needs.
- [ ] **License and maintainer check (half a day plus waiting time).** Confirm DDS NOTICE obligations; ask BEN maintainers about redistribution of the bundled EPBot, BGA and SuitC binaries; ask the pons author about API stability and willingness to accept a beginner-system contribution. Ask Ralph Lipe whether "bridgit-ts" will be published under MIT.

## Appendix: tests run and sources

All tests ran on 2026-10-17 on macOS (Darwin 23.6, Apple Silicon) with Node 18.20.8, Python 3.12.2 and Rust 1.93.0. The reference for correctness was endplay 0.5.12, which bundles native DDS 2.9.

### Test log

| Test | Command / method | Result |
| --- | --- | --- |
| Reference deals | `endplay.dealer.generate_deals(produce=100, seed=42)`, then `calc_dd_table` | 100 deals, 100 DD tables in 6.9 s |
| bridge-dds DD tables | `CalcDDTablePBN` on the 100 deals (after patching `api.js` import for plain Node) | 0/100 mismatches; median 121 ms, max 2,200 ms per table |
| bridge-dds per-card | `SolveBoardPBN(target=-1, solutions=3)`, West leads vs NT, deals 1–10 | 0/10 mismatches vs `endplay.dds.solve_board` |
| @bridge-tools/dd per-card | `doubleDummySolve(deal, [], 'W', 'NT')`, same 10 deals, one process | 2/10 correct; 8/10 contained cards not in the hand (up to 20 entries); 5/10 had wrong trick values |
| macroxue native | `make && make test` | "All passed." |
| macroxue vs DDS | `solver -f` on the 100 deals | 0/100 mismatches; about 9.9 s total |
| macroxue web app | Headless Chromium: Random deal, Solve | "Solved in 732 ms"; DD table and par shown; 0 console errors |
| DDS 3.1 web demo | Headless Chromium: sample "Everyone makes 3N" | crossOriginIsolated = true; "Solved in 71 ms"; 1 resource 404 |
| pons tests | `cargo test --release --lib --tests` | 1,486 passed, 0 failed |
| pons book | `cargo run --release --example render-book` | 36,678 lines of rule text |
| pons web app | Headless Chromium: Practice, Deal | Page loaded with 0 console errors; no deal appeared within 15 s; no `.wasm` request observed. Inconclusive. |
| saycbridge | `python ../scripts/test-sayc` with z3-solver + networkx | 1,325 of 1,483 hands (89.3%); 198 of 207 rules exercised |
| saycbridge explain | `scripts/explain 1N P 2C` | Rule trace + constraint ranges (developer format) |
| ts-contractbridge | `npm test` (Vitest) | 27 files, 563 tests passed |
| BEN API | `python gameapi.py`; `GET /bid`, `/explain`, `/explain_auction`, `/lead` | 2♣ Stayman in 0.06 s; explanation "Stayman -- ; 7+ HCP; Artificial; Forcing"; lead ♠Q in 1.8 s with 4 ranked candidates |

### Inspected source locations

- DDS WASM build and limits: [`docs/wasm_build.md`](https://github.com/dds-bridge/dds/blob/main/docs/wasm_build.md), [`web/`](https://github.com/dds-bridge/dds/tree/main/web), [`ci_wasm.yml`](https://github.com/dds-bridge/dds/blob/main/.github/workflows/ci_wasm.yml)
- BEN explanations via EPBot: [`src/gameapi.py` `/explain`](https://github.com/lorserker/ben/blob/main/src/gameapi.py), [`src/bba/BBA.py`](https://github.com/lorserker/ben/blob/main/src/bba/BBA.py); limitations in [README](https://github.com/lorserker/ben#what-the-engine-cannot-do-yet)
- pons single-dummy design: [`src/single_dummy.rs`](https://github.com/jdh8/pons/blob/main/src/single_dummy.rs); web front end: [`web/README.md`](https://github.com/jdh8/pons/blob/main/web/README.md)
- saycbridge rules and harness: [`src/z3b/rules.py`](https://github.com/eseidel/saycbridge/blob/master/src/z3b/rules.py), [`src/README.md`](https://github.com/eseidel/saycbridge/blob/master/src/README.md)
- Bridgit annotations: [`BridgeBidder/CallAnnotation.cs`](https://github.com/TricksterCards/Bridgit/blob/main/BridgeBidder/CallAnnotation.cs)
- GNUBridge robot sees all hands: [`DealController.java`](https://github.com/pslusarz/gnubridge/blob/master/src/main/java/org/gnubridge/presentation/gui/DealController.java)
- EPBot license statement: [BBA README](https://github.com/EdwardPiwowar/BBA#license)

### Web sources opened

- [BBO News: "AI Evolution in the World of Bridge"](https://news.bridgebase.com/?p=28455), 2024-01-09: ACBL-Ben vs Advanced GIB. Declarer play in suits 48.41% vs 55.93%; NT 49.21% vs 50.87%; defense 49.3% vs 50.8%; contracts bought 53% vs 50%. This predates BBO's December 2025 GIBBO upgrade.
- [arXiv 2406.10306](https://arxiv.org/abs/2406.10306), Kita, Koyamada, Yamaguchi, Ishii (IEEE CoG 2024): "A Simple, Solid, and Reproducible Baseline for Bridge Bidding AI"; code and models released. The +1.24 IMPs/board vs WBridge5 figure comes from the [brl README](https://github.com/harukaki/brl), not the abstract.
- [Trickster Cards: 2/1 Preview](https://bridge.trickstercards.com/help/two-over-one-preview/): Ralph Lipe created the open-source Bridgit, which "powers our 2/1 experience".
- Not opened: Graham Hazel's WASM write-up (cited by `@bridge-tools/dd`) returned HTTP 403.
