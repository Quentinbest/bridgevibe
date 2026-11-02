# Bridge-Classroom fit check (T4)

T4 (PRD §13, required) and gate deliverable 5 (PRD §13.9), for the **Foundation** decision (PRD §14): adapt Bridge-Classroom, or assemble components. Run 2026-10-31 by Claude on desktop Chromium; the reference phones are not yet run (with #28).

**Answer.** At the cited commit, `bridge-craftwork/Bridge-Classroom@f4ec8c0`, the full unit suite is green and a production build with the real Rusty WebAssembly succeeds. It cannot run offline as shipped. Its back end is required even to start, and lessons are fetched from GitHub at run time. BBA is a remote service rather than bundled code, but learners' bids are marked against BBA's auction. Without BBA, the practice table says "You matched the BBA all the way through": a false verdict.

With a local API server and two lines changed to serve the lessons locally, one lesson ran with the internet blocked, and so did a practice deal's auction. With RulesBot chosen, a whole practice deal was played: 3NT by South, down 1, with robots that run in the browser. Against the Foundation rule (PRD §14), this is a **fail** at the cited commit: T4 needs an offline build with BBA removed, and it isn't one.

## The PRD's questions

| Question (PRD T4) | Result | Evidence |
| --- | --- | --- |
| Full unit suite at the cited commit | **Pass** | Front end: 782 of 782 with the real WebAssembly (779 passed and 3 skipped without it). Rust API: 65 of 65 |
| Production build with the real Rusty WebAssembly | **Pass** | `vite build` exits 0 (7.1 MB, with chunk-size warnings). It uses rusty-bidding-bot `v0.2.0` from the pinned release, SHA-256 `1b3cb5ef…` verified, rules `9e14c0c135fb8ae4` |
| BBA removed from the built artefact (LR-3) | **Fail** (run-time calls) | (a) code and binaries: the licence check's content scan finds 0 byte and 0 path findings in the 141 built files. (c) run-time calls: the bundle calls `bba.harmonicsystems.com` for reference auctions, and 5 front-end modules import `bbaClient` |
| One lesson offline | **Fail as shipped; passes with a patch** | As shipped: "Could not load lesson catalog. Failed to fetch". With the lessons bundled locally (below), Baker Bridge, Major Suit Openings board 1 loads and the scripted auction and commentary run with the internet blocked |
| One practice deal offline | **Pass with settings, South declaring only** | The deal is dealt locally and Rusty bids all three robot seats. Requests to the BBA, double-dummy and scenario services are blocked. Card play is supported only when South declares. With South declaring and RulesBot chosen (BEN is the default and is remote), a whole deal was played offline: 3NT by South, "You took 8 tricks · needed 9 to make — down 1". RulesBot made 19 decisions, averaging 6 ms and at most 71 ms. Only the double-dummy review (`/dd/play`) was lost |
| On the reference phones | **Open** | Deferred with the #28 phone session |
| What MiniBridge setup and our coach labels would take | **Estimate below** | — |

## What "offline" runs into

At the cited commit the app is a client of six services, all run by its authors:
- the API, Rust/Axum/SQLite;
- BBA, for bidding reference auctions;
- a double-dummy solver;
- BEN, for card play;
- a deal generator;
- a table service, over WebSocket.

Each blocks something:
- **No service worker.** A reload without the network cannot start the app.
- **Onboarding needs the API.** Name, surname and email are posted to `/api/recovery/request`; without the server, "Unable to connect to server. Please try again." There is no guest path.
- **Lessons are fetched at run time.** They come from `raw.githubusercontent.com/bridge-craftwork/Baker-Bridge/main/…` and `ADavidBailey/Practice-Bidding-Scenarios/main/…`, both unpinned `main`.
- **Third-party calls on first load:** Google Fonts and the GoatCounter analytics script (`gc.zgo.at`).
- **The practice table's default bots are remote.** The default bidder is BBA and the default card-play bot is BEN. Rusty and RulesBot both run in the browser, but must be chosen in Table settings.

**Patch used for the offline runs.** Two lines in `src/composables/useAppConfig.js` point the Baker Bridge collection at `/content-baker-bridge/`. The 102 files (7.5 MB) of `Baker-Bridge@400dcb8:bridge-classroom/` were copied into `public/`. The API ran locally with a throwaway SQLite database. Every other host was blocked in the browser after the first load. Baker-Bridge content carries its own LR-5 question (deals filtered with EPBot, PRD §12); it was used here only to test the mechanism.

## BBA and the learner's feedback

- **Rusty doesn't replace BBA as the reference.** Bot seats bid with BBA by default or with Rusty (`?bidder=rusty`), but "the student is still marked against BBA's auction". Where Rusty has no rule, the table takes BBA's call (`rustyBidder.js`, `localEngine.js`).
- **False verdict without BBA.** `src/composables/engines/localEngine.js:182` reports "You matched the BBA all the way through" whenever no bid diverged. When the BBA reference is unavailable, nothing can diverge, so a learner gets that verdict after a whole auction that was never checked. This was seen in the offline run.

  It is the opposite of CI-4 (abstain, never claim) and VAL-06 (0 silent fallbacks). Turning off "Show BBA auction comparison" hides the summary, so no verdict is shown at all.
- **Removing BBA means a new expected-auction source.** That would be a rule-backed bidder that abstains as "not covered", which is the T5 decision.

## Fit with BridgeVibe's requirements

| Area | Bridge-Classroom at f4ec8c0 | BridgeVibe needs |
| --- | --- | --- |
| Stack | Vue 3, Vite, plain JS (about 62,000 lines of front end); Rust/Axum API (about 20,000 lines) | React 18 and TypeScript, browser-only (U-08 for V; the MVP framework is a gate decision) |
| Offline (NFR-C3) | Needs its API and GitHub-hosted content | Everything in the browser |
| Information boundary (ADR-0001) | Bots receive a seat-limited context by convention (`cardplayBots.js`). The full deal is in the same JS context, and bots run on the main thread | Branded Seat Views, a worker boundary, and lint and dependency rules (F3, VAL-05) |
| Card-play roles | Practice play only when South declares; "defender and dummy modes will arrive in a future release" | MiniBridge alternates declaring and defending (#18) |
| MiniBridge setup (US-06) | None: an auction-based table | Point announcements, the declarer and Contract Choice (#12) |
| Coach labels (CI-1 to CI-4) | Double-dummy cost is "best-effort", and BBA comparison is the only bidding verdict | VISIBLE/ALL_HANDS modes, hindsight labels, the four verdicts, and abstention reasons, with provenance (CI-5) |
| Content | Baker-Bridge and PBS lessons in PBN, scripted by `[show]`/`[BID]`/`[PLAY]` directives | Authored lessons with content IDs and versions (ADR-0004) |

## What adding MiniBridge setup and our coach labels would take

A rough estimate, at the same granularity as the PRD's track estimates (engineer-days, *estimate*):

| Work | Days | Why |
| --- | --- | --- |
| Make it run offline: bundle and pin content, drop onboarding's API dependency, a service worker, self-hosted fonts, analytics removed | 4–6 | Onboarding, sync and the lobby assume the API is there (`useUserStore`, `useDataSync`) |
| Remove BBA: a rule-backed reference auction with "not covered" abstentions; fix the false "matched" verdict | 5–8 | Five modules import `bbaClient`; marking, scenarios and convention cards assume BBA |
| MiniBridge setup: announcements, declarer, Contract Choice, MiniBridge scoring | 6–9 | No equivalent in the auction-based table; needs a new phase before play |
| Learner as defender and as dummy's partner | 4–6 | Not supported yet upstream |
| The information boundary: Seat-View-only inputs for bots and hints, in a worker, with permutation tests | 6–10 | Today it is by convention, with the full deal in scope |
| Our coach: hints, trick cost with hindsight labels, the four verdicts, abstentions and provenance | 10–15 | Bridge-Classroom has no equivalent layer |
| Port to TypeScript and React, or accept Vue and Rust | 0 or 15–25 | PRD §14 asks whether "its Vue and Rust stack is acceptable" |
| **Total** | **35–54, plus 15–25 if ported** | For scale: the PRD sizes all required Phase V tracks at about 34 engineer-days (PRD §13) |

The gate's Foundation rule asks for an MVP estimate at least 25% lower than the component path (provisional margin). These numbers point the other way. The component path already has most of these pieces, built and tested (#12, #18, #21–#27).

## Still open

- The reference phones (iPhone 16, Pixel 9): the same patched build, run by the owner with the #28 phone session. Given the fail above, this matters only if the owner wants Bridge-Classroom kept as a candidate.
- An MVP estimate for each path belongs to #125, which will use these numbers.

## How this was run

- **Workspace:** a git worktree of the pinned checkout at `.reference-solvers/t4/bc` (local, gitignored). The pinned checkout that the licence report scans was not modified.
- **Front end:**
  - `npm ci --ignore-scripts`, then `npx vitest run`;
  - `node scripts/fetch-rbb-wasm.mjs`, then the smoke tests;
  - `VITE_API_KEY=t4-local-key npx vite build`, then `npx vite preview --port 4310`.
- **API:** `cargo test` in `bridge-classroom-api`, then `cargo run` with a throwaway database, a local API key and no mail or GitHub settings.
- **Browser runs:** headless Chromium (Playwright) at 390 px and 1440 px. Every non-local request was aborted after first load.
- **Licence scan:** `scanBytes` and `prohibitedPaths` from `scripts/licences/core.ts`, with `denylist.json`, over `dist/`.
