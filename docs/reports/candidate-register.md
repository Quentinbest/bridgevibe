# Candidate register (T8)

The one candidate register (gate deliverable 10, PRD §13.9; R §9.4), as of 2026-11-01. It replaces the candidate tables in the three October research reports, which disagree. Licences are from [`licence-candidates.md`](licence-candidates.md); evidence links point to this repository's checks and reports.

**The re-scan (T8) found no new candidate that changes a gate decision on the evidence available.** Two new MIT-licensed TypeScript apps with explained, rule-based bidding appeared in late October 2026. Whether to add either to the bidding comparison (T5) before the teachers grade it is an owner decision; see [New since the reports](#new-since-the-reports).

## Register

Status words:
- **candidate:** in play for a gate decision;
- **run:** evidence collected;
- **dropped:** removed by an owner decision;
- **not adopted:** a gate rule already settles it;
- **excluded:** with the reason;
- **reference:** design reference only.

| Responsibility (PRD §12) | Candidate | Pin | Licence | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Double-dummy analysis | bridge-dds: bookchris/bridge-dds-js (DDS 2.9, WebAssembly) | npm 1.4.0 | Apache-2.0 | **candidate**: passes F2; phones pending | VAL-03 (`src/analysis/f2.test.ts`, #22); #28 |
| Double-dummy analysis | macroxue/bridge-solver | 630705d | Apache-2.0, MIT | **candidate**: passes F2; phones pending | VAL-03 (#22); #28 |
| Double-dummy analysis | DDS 3.1, single-threaded WebAssembly | fe6a658 | Apache-2.0 | **candidate**: passes F2; phones pending | VAL-03 (#63); #28 |
| Double-dummy analysis | DDS 3.1, threaded (cross-origin isolation) | fe6a658 | Apache-2.0 | **candidate, on hold** | #82, waits on #28 |
| Double-dummy analysis | pons-dds | 12689f0 | Apache-2.0 | **candidate (optional)**: not integrated | US-43.1 |
| Double-dummy analysis | @bridge-tools/dd | npm 0.2.2 | MIT | **excluded**: wrong results (up to 20 cards in a 13-card hand; wrong tricks in 5 of 10 deals) | Report A, notable rejections |
| Rules and state core | Our own TypeScript core | in repo | — | **adopted for V**: passes F1 and F6 | VAL-01, VAL-02 |
| Rules and state core | RalphLipe/ts-contractbridge | 8a788cf | MIT (for `packages/ts-contractbridge` only; no root licence, per the review §6.2) | **not adopted**: §14 keeps our core unless extraction is cheaper; ours already passes | licence report |
| Lesson foundation | Bridge-Classroom | f4ec8c0 | Unlicense | **run: fails T4** at the cited commit (offline, BBA at run time, false verdict) | [`bridge-classroom-fit.md`](bridge-classroom-fit.md), #123 |
| Lesson content | Baker-Bridge | 6009854 | Unlicense | **candidate (MVP content)**: LR-3 fails in the checkout; LR-5/6 open (deals filtered with EPBot) | licence report; PRD §12 |
| Bidding and explanations | rusty-bidding-bot | 091175f | Apache-2.0, MIT | **run (T5)**: LR-3 fails on fixtures; LR-5/6 open (stock convention cards) | [`t5/`](t5/), licence report |
| Bidding and explanations | saycbridge | 6d5c1c0 | BSD-3-Clause | **run (T5)**: LR-3 and LR-7 open (unscanned files) | [`t5/`](t5/), licence report |
| Bidding and explanations | Bridgit | ee9ade9 | MIT | **candidate, not run**: needs .NET; the owner skipped installing it (2026-10-31) | [`t5/`](t5/) |
| Bidding and explanations | pons `american_instinct()` | c865f4a | Apache-2.0 | **dropped** (PRD D11, 2026-10-30) | #34 |
| Bidding and explanations | EPBot / BBA | — | none (freeware) | **excluded**: LR-3 | PRD LR-3 |
| Bidding and explanations | bridge-craftwork/bidbase | — | MIT, Apache-2.0 | **not assessed**: only report C screened it | report C §3 |
| Robot policy | Our own principles policy (DEP-03) | in repo | — | **adopted for V** | #13, F7 |
| Robot policy | BEN | ad8608a | GPL family | **excluded for now**: LR-3 and LR-4 fail (bundled BBA/BGA/SuitC binaries) | licence report; PRD §12 |
| Tooling (not shipped) | endplay | 260af10 | MIT | **used**: F2 references | licence report |
| Tooling (not shipped) | anntzer/redeal | — | GPL-3.0 (`LICENSE.txt`; report A's "unclear" was refuted by the review, §8 item 10) | **reference** | report A; review §6.2 |
| Authoring tooling (not shipped) | bridge-craftwork/bridge-lesson-packaging | a2fc0db | Unlicense | **reference**: optional tool for splitting and rotating PBNs and making handouts; documentation screened only | report C §8 |

**Screened in the reports and not taken further.** Each is either reference-only or excluded for the reason given. They are kept here so the three tables have one home.

| Candidate | Reason |
| --- | --- |
| frankwallis/redouble, richardschneider/bridge, kduffie/bridge-engine, pslusarz/gnubridge, erik-knudsen/BridgeZ, jarekczek/pbntools, Kungsgeten/bml, pfdubois/BridgeBidding, google-deepmind/open_spiel, sotetsuk/pgx, harukaki/brl, BSalita/SH_Bidding | **Reference only**: old stacks, desktop or research code. GNUBridge's robots see all hands, so it is no teaching model |
| macroxue/bridge-bidding-practice, bridge-tools/core, jfklorenz/Bridge-Package, jfklorenz/Bridge-Scoring-Package, richardschneider/bridge-scorer, hdkz-dev/multi-game-engines, GuCasper/btf-minibridge-dds | **Reference or narrow reuse**: helpers our own core already covers |
| facebookresearch/jps | **Reference only**: archived research code, CC-BY-NC 4.0 (no commercial permission) (report C) |
| hanyuu11/bridge_learning | **Excluded**: research environment with no root licence (LR-1) (report C) |
| cowbell/bridge, syfun/contract-bridge | **Excluded**: no licence grant found (LR-1) (report C) |
| kdblocher/bridge | **Excluded**: custom Shared Source licence, up to two users per entity, commercial licence required; not open source (report C) |
| bridge-craftwork/Bridge-Offline-Practice, juef17/LibreBridge | **Excluded**: GPL desktop or app code, not a web foundation |
| brannondorsey/nickel-bridge, jinsoowhang/bridge-game-coach, maxgiraldo/playbridge, PGreen90/Learn-Bridge, ebridge/bridge-web, rajnesh/bridge-bidding-system-js, tomron/bridge-kids, jazzychad/bridge-trainer, igiel/BridgeLesson | **Excluded**: no licence (LR-1), or student and demo code |
| PyBridge, FreeBridge (SourceForge) | **Excluded**: inactive GPL desktop clients |

## New since the reports

Of the 570 card-bridge repositories that no report lists, 97 were pushed since 2026-09-01 and 23 were created on or after 2026-10-16 (9 of them licensed). Those that touch a gate decision:

| Candidate | Created | Licence | What it is | Decision it touches | Recommendation |
| --- | --- | --- | --- | --- | --- |
| [otsirh/bridge-tutor](https://github.com/otsirh/bridge-tutor) | 2026-10-20 | MIT | TypeScript app, offline-capable; its tutor gives "the recommended call, the rule behind it and a checklist of its requirements" | Bidding engine (browser fit) | **Owner decision**: add its bidder to T5 before the teachers grade the sheet, or leave it out. 11 days old; no licence assessment yet; text search finds no EPBot/BBA references (the "BBA"/"BEN" hits are Italian words) |
| [irom77/contractplay](https://github.com/irom77/contractplay) | 2026-10-25 | MIT | React/Vite table with separate `core` and `bots` packages; SAYC and 2/1 bots by level | Bidding engine | **Owner decision**, as above. 6 days old |
| [billchiles/biddybop](https://github.com/billchiles/biddybop) | 2026-10-27 | Apache-2.0 | Bidding-practice app built on guidelines and agreements | Bidding engine | Watch only: a practice app, no explained engine |
| [bridge-craftwork/bridge-solver](https://github.com/bridge-craftwork/bridge-solver) | 2026-01-25 | Apache-2.0 | Rust port of macroxue/bridge-solver with a browser build | Solver | Not needed: macroxue itself passes F2. Consider only if no candidate passes VAL-04 |
| [krtschil/bsol-wasm](https://github.com/krtschil/bsol-wasm) | 2026-08-22 | Apache-2.0 | WebAssembly build of Bridge Solver Online's modernised solver | Solver | As above |
| [tameware/sds](https://github.com/tameware/sds), [jdh8/suit-combination](https://github.com/jdh8/suit-combination) | 2026-08, 2026-10 | none; Apache-2.0 | Single-dummy solvers | None at the gate; could inform sampled feedback (#27) after it | Reference |
| npm `miaoda-game-bridge-rules` | 2026-08-02 | MIT | Rules engine for duplicate bridge; no source repository linked | Rules core | Not needed: our core passes F1 and F6 |
| [bridge-craftwork/bridge-lessons-advanced](https://github.com/bridge-craftwork/bridge-lessons-advanced), [bridge-lessons-by-andrew-rowberg](https://github.com/bridge-craftwork/bridge-lessons-by-andrew-rowberg) | 2026-02 | Unlicense | Community lesson content | MVP content (not a gate decision) | Note for the MVP content plan; rights checked as for Baker-Bridge (LR-5) |

None changes a gate decision on present evidence. The solver, rules and robot decisions each already have a candidate that passes, or is waiting only on the phone runs. The two bidding apps are the only ones that could change a choice, and only if T5 includes them.

## The re-scan (T8)

Run 2026-11-01 by Claude. It reran the union of the three reports' searches (R §9.3 item 7):

| Source | Queries | Results |
| --- | --- | --- |
| GitHub repository search | 46 queries, the union of reports A–C including the non-English and LLM terms ([list](t8/github-queries.txt)); up to 100 results each | 1,052 unique repositories ([all, classified](t8/github-scan-2026-11-01.csv)) |
| GitHub topics | `contract-bridge`, `bridge-game`, `double-dummy`, `bridge-bidding`, `bridge-solver`, `bridge-card-game` | included above |
| npm registry | *contract bridge*, *bridge dds*, *double dummy*, *pbn bridge*, *bridge bidding*, *bridge-tools*, *minibridge* (50 each) | 1 new relevant package |
| PyPI (named lookups) | endplay 0.5.12, ddstable 0.2.0, bridgeobjects 0.1.35, bridgebots 0.0.12; redeal is not on PyPI | no change |
| GitLab and Codeberg APIs | *contract bridge*, *minibridge*, *double dummy*, *bridge bidding* | GitLab: 3 relevant (Tom_Fryers/contract-bridge, jyutzler/Bridge-Systems, an undescribed 2020 minibridge); Codeberg: none |

**Classification of the 1,052 GitHub results:**

| Classification | Count | How decided |
| --- | --- | --- |
| Already in a 2026-10 report | 35 | Matched against every GitHub link in the reports |
| Not card bridge | 447 | Name and description filter: blockchain, ROS/DDS middleware, chat bridges and so on |
| Card bridge, no licence | 406 | Excluded under LR-1 |
| Card bridge, licensed | 164 | Reviewed by name, description and date; decision-relevant ones read (table above) |

**Gaps.**
- Web search was not rerun, so SourceForge and the closed products were not rechecked.
- GitHub search returns at most 100 results per query.
- The relevance filter is a pattern on names and descriptions, so a repository with neither may be missed.
- The new apps were screened, not assessed: no licence scan, no build, no T5 run.

**Stopping rationale.** The last queries (non-English, topics, npm, GitLab and Codeberg) added no candidate for a gate decision beyond the two bidding apps found by the core queries.
