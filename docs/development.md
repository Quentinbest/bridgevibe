# Development notes

The longer notes behind [`AGENTS.md`](../AGENTS.md): read the part a task needs.

## Checks

| Command | What it runs |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` over everything (with Node types), then `tsconfig.app.json` over app source with browser types only |
| `npm run lint` | ESLint (typescript-eslint; react-hooks on all `src` files, react-refresh on components; browser globals only in app source) |
| `npm run deps:check` | dependency-cruiser module rules over `src` |
| `npm test` | Vitest **node** project: unit, jsdom component, catalogue guard, dependency-rule fixtures |
| `npm run test:browser` | Vitest **browser** project (headless Chromium): `src/table/**/*.test.ts` and `src/app/**/*.browser.test.tsx` |
| `npm run build` | Production Vite build, licence BOM and NOTICE; fails on licence violations |
| `npm run test:e2e` | Playwright with axe; builds first, then serves `vite preview` on 127.0.0.1:4173 |
| `npm run check` | All of the above, in CI order |

- One Vitest test: `npx vitest run --project node <file>`, with `-t "<name>"` to filter by test name.
- One Playwright project: `npx playwright test --project 390-dark`. Projects are `<width>-<light|dark>` for widths 320, 390, 600 and 1440.

CI (`.github/workflows/ci.yml`) runs each check as its own step. E2e runs `vite build --mode audit`, auditing every real robot worker message against the Table record and exposing counts and violations for assertions (US-10.2). Production builds remove this audit code.

## Licences

Every production build runs `scripts/licences/` (US-46, LR-1–LR-7). It writes
`licence-report/bom.json` and ships `dist/NOTICE.txt` with full third-party licence
texts, including the font OFL notices. CI uploads both files, including after a
failed build. Only shipped modules and assets are attributed; development-only
packages are excluded unless their helpers reach the bundle.
Assets are never inlined, so each is attributed.

Package versions come from `package.json`, but grants come from actual licence
files. Missing or unrecognised grants, GPL-family licences, unknown virtual
modules, undeclared assets and prohibited package names or output bytes fail the
build. `scripts/licences/denylist.json` holds the LR-3 / US-46.4 tripwires; every
file in the output directory is scanned, including binaries and NOTICE.

Declare public files and imported artwork, icons or WebAssembly in
`licences/assets.json` with their source or shipped path, repository licence file,
licence name and attribution. The declared licence must match the file's grant.
First-party code is recorded separately with distribution model D2 still open.
Track unanswered DEP-08 questions in `licences/open-items.json`; these are copied
into the BOM, not treated as grants.

Only owner-reviewed exceptions may be added to `licences/allow-list.json`:
provide exactly one `package` or `path`, the exact `version`, `reason`, `reviewer`
and `date`. Obtain review before adding an entry. An entry covers a missing or
unrecognised grant, or, with `elected`, a dual-licensed artefact: `elected` names
the non-GPL grant its own licence files make (for example `"MIT"` for "MIT or GPL"),
and the BOM records that election. GPL-only artefacts and LR-3 violations cannot be
exempted. The list starts empty.
For isolated builds, `licences({ reportPath })` or the
`BRIDGEVIBE_LICENCE_REPORT` environment variable redirects the BOM destination.

## Modules

`src/<module>/` follows engineering spec §4.2: one module per bounded context, created by the ticket that needs it. Today there are four:

- **table**: the authoritative rules core. `startPlaythrough({ deal, contract })` returns a handle with `legalActions(seat)`, `submit(seat, controller, action)`, `seatView(seat)` and `record()`. It checks card plays, owns turns and trick winners, exposes Dummy after the opening lead, and completes after 13 tricks. Rejections preserve all state. It **may depend on nothing**: no other module, package or Node builtin (its tests may import Vitest).
- **robots**: the `RobotPolicy` port, `bv-basic` and deterministic `bv-fallback` (§4.6.6), receiving only a branded `SeatView`, seed and deadline. Both policies currently use the same card rule; #13 replaces the basic policy rules. It imports only Table. ESLint prohibits full-Deal types and SeatView assertions outside Table.
- **explanation**: the string catalogue (`catalogue` keyed by ID, `text(id, params)` with `{param}` interpolation). Every entry carries `status: 'draft'` until a teacher signs it off (CI-8).
- **app**: the composition root and all UI. Only **app** may import **app**.

`.dependency-cruiser.cjs` enforces the module rules, and `test/dependencies.test.ts` proves each rule fails on the fixtures in `test/fixtures/`. When a ticket adds a module, add its §4.2 rule and a failing fixture for it.

Rules every later module must keep:

- The Table is the only authority on rules: the UI and robots only submit actions (INV-1).
- Robots and in-play hints receive only a Seat View, never a full Deal. Only **table** constructs Seat Views and completed playthrough records (ADR-0001).
- The UI is built from a learner view: face-up cards plus a count for each hidden hand. No hidden card identity reaches React props, page text or accessibility names (US-16.4). The fixed Deal lives in `src/app/fixture.ts` for composition; `src/app/play.ts` projects South’s SeatView into the learner view. The authored Deal is necessarily present in the client bundle in this fixed-Deal slice.
- When the learner's side declares, the learner plays Declarer, and the display rotates so Declarer is at the bottom (ADR-0003).
- Robots run `bv-basic` in a versioned Web Worker from an encoded Seat View (#8). The host enforces a 400 ms deadline and a constant 500 ms display delay, records marked timeout/engine-failure fallbacks, and disables the worker after three session failures. Hidden pages cancel pending requests; interrupted decisions restart with fresh deadline and display windows on return. Trick collection remains 1 s. The trivial fallback uses the same Seat View on the main thread; neither policy needs WebAssembly.

## No hard-coded learner-facing text (US-38)

All copy, including aria labels, comes from `text()`. `test/catalogue.test.ts` parses every non-test `src/app/**/*.{ts,tsx}` file with the TypeScript compiler. It fails on:

- JSX text, or a literal or template child, containing a letter or digit;
- a literal or template value of `aria-label`, `aria-description`, `title`, `alt`, `placeholder` or `label`;
- any phrase-like literal or template (a letter and a space in its fixed text) anywhere in the file, except class names and import paths;
- a JSX child or protected attribute whose type is a string literal, which catches a word kept in a constant (`const label = 'Continue'`) or imported from a helper module.

A word in a widened `string` (`let label = 'Continue'`, or a value typed `string`) still passes; review catches those.

## Theme and fonts

- **Tokens:** design tokens are defined once, as CSS custom properties in `src/app/tokens.css`.
- **Theme selection:** the theme follows `prefers-color-scheme`, and `data-theme="light|dark"` on `<html>` overrides it.
- **Felt and cards:** these look the same in both themes, because no light-theme table was designed.
- **Contrast:** suit colours must keep at least 4.5:1 contrast on the card face. `src/app/tokens.test.ts` checks this.
- **Fonts:** self-hosted via @fontsource, with their OFL notices in `public/licences/fonts/`. Nothing loads from a CDN.

## Responsive hand

Every card keeps at least a 44 px touch target, or a 44 px exposed edge when overlapped (ux-spec §3.1 and §10). The layout depends on width:

- **720 px and wider:** one overlapping row.
- **Below 720 px:** two suit columns; long seeded suits wrap within their column.
- **Below 356 px:** one suit column; a long suit can occupy multiple rows.

These breakpoints are unchanged: 720 px fits the 608 px overlapping row plus padding;
356 px fits the authored fixture's 316 px two-column hand plus padding. A seven-card
suit needs 308 px without overlap. Below 720 px, each card remains a non-shrinking
44 × 80 px box and the suit wraps when its grid track is narrower than 308 px
(at 320 px, the single track is at most 280 px, so seven cards require two rows).
At 720 px and wider, 80 px cards overlap by 36 px, leaving a 44 px exposed edge.

Deal controls occupy a single 44 px header row with 8 px vertical padding (none below
400 px, where the wordmark is hidden). Invalid-link feedback replaces the wordmark
inside that row, so neither controls nor feedback add rows to the deal status.

The breakpoints are derived in comments in `src/app/styles.css`, and `test/e2e/table.spec.ts` checks the same arithmetic. If card sizes or padding change, update both.

## Reading the design bundle

`docs/design/BridgeVibe UI.html` is a 5.8 MB packed bundle; don't read it directly. It has two layers:

1. **Outer bundle:** its `__bundler/manifest` script maps IDs to base64 data, gzipped when `compressed` is true. Its `__bundler/template` lists the screens: each one's title, size and ID.
2. **Screen bundle:** each screen's HTML is itself a bundle. Its `__bundler/template` is readable HTML with inline styles.

Decode a screen from both layers, and strip the `@font-face` blocks before reading. The mock-ups still show the old "playbridge" wordmark; the product name is **BridgeVibe** (D6), rendered as text.

## Ticket Definition of done

Every issue repeats this list. A ticket is done when:

- every acceptance criterion is tested at the highest practical seam;
- every CI check passes;
- all copy comes from the catalogue, marked as a draft;
- the UI works at 390×844 and 1440×900, in light and dark themes, with keyboard, screen reader and reduced motion;
- nothing outside the ticket's scope is built, and gaps are raised as issue comments.

## Scoring

The standalone duplicate scorer is `src/table/scoring.ts`, exported by Table (US-09.1–2, A-01). Its ordered, numeric breakdown is ready for later explanation templates. F6 uses `src/table/f6-reference.json` (2,940 cases from two pinned reference scorers) and `src/table/f6-law77.ts` (16 hand-calculated examples), with the same suite configured for Node and Chromium. To regenerate offline, place the MIT `packages/ts-contractbridge` sources from RalphLipe/ts-contractbridge commit `8a788cf0a926ea0413f9d21091858bf4dc95bcfc` in `.reference-scorers/ts-contractbridge/` and npm `contract-bridge@3.2.1` in `.reference-scorers/contract-bridge/`, then run `node scripts/scoring/generate-f6-reference.ts` with Node 24. The script uses the installed TypeScript compiler and Node module hooks to load the TypeScript reference's `.js` imports; it writes deterministic JSON with source/version/licence metadata and preserves both scores on disagreement. Reference sources are ignored by Git and ESLint; neither they nor the generator enter the app bundle.

## Gameplay checks

F1 in `src/table/playthrough.test.ts` runs unchanged in Node and Chromium. It checks reason precedence, rejection immutability, controller rules, blind leads, trick winners, completion and snapshot isolation. `test/boundaries.test.ts` checks the private SeatView brand at typecheck time and exercises ESLint restrictions through its API. Dependency fixtures include a robot importing explanation.

The shared first-legal learner strategy completes the fixed Deal with 6 declaring-side tricks against fallback defenders. Node tests cover the Table and timer composition seams. Playwright uses its clock for a full Deal on `390-light` and `1440-dark`; keyboard, rejection, hidden-card, layout, theme and axe checks run on every project. Layout checks advance through the opening lead to expose Dummy, then resume timers before axe audits the initial, raised-card and rejected-card states. They also check viewport height and footer overlap. Browser checks require permission to bind local ports; in a sandbox that blocks ports, leave them for an unrestricted runner.

## Dealing

US-03.1/03.4, approved U-04 (2026-10-20): `bv-deal-1` uses xoshiro128** 1.1.
The generator choice is delegated to the implementer. SHA-256 of UTF-8 `${seed}:${index}`
initialises its four words from the first 16 digest bytes, big-endian; an all-zero state
becomes `[1, 0, 0, 0]`. No warm-up steps are discarded. All generator operations use
32-bit integer arithmetic. Fisher–Yates shuffles `SUITS × RANKS`, using rejection sampling
before bounded reduction. Consecutive blocks of 13 go to North, East, South, West;
each hand is sorted back into canonical order. Dealer and vulnerability repeat the
standard duplicate board cycle 1–16. Indices are positive safe integers; the final
safe index cannot advance further (New deal is disabled).

Content IDs are `deal-` plus the first 16 hex digits of SHA-256 of compact JSON:
`[hands, dealer, northSouthVulnerable, eastWestVulnerable]`. Hands are four arrays in
North/East/South/West order of sorted canonical card indices (0 = spade Ace, 51 = club 2).
Origin is excluded. The synchronous SHA-256 has standard digest tests.
`src/table/dealing-vectors.json` publishes full PBN Deals and IDs, pinned by the same
suite in Node and Chromium. Changes to this algorithm require a new identifier.

Links use `?seed=abc&deal=3`. Seeds contain 1–64 ASCII letters, digits, `_` or `-`;
indices use positive decimal notation. Missing both parameters retains the authored
fixture; malformed or incomplete links show the fixture with feedback. New deal advances
a seeded index, or creates a 12-character seed with `crypto.getRandomValues` for an
authored Deal, and replaces the URL. Play remains 3NT by South until #12.
Deal info displays metadata only. Copy remains draft (CI-8); replay still reads the
Playthrough Record, never regenerated actions (ADR-0002).

## Lessons

`?lesson=follow-suit-full` opens the three-exercise unsigned draft Follow suit lesson.
`?lesson=follow-suit` retains the original five-step exercise as a short lesson;
it is also the full lesson's first Exercise. Close returns to practice.
The other two fixed Deals have their own content IDs and rights records. They
repeat following hearts with a teaching Exposure, then an unaided Prompt.
All content and catalogue copy await teacher sign-off (CI-8).

`src/curriculum/lessonPlayer.ts` composes `createPlayer` for each Exercise in order,
creating a separate Table Playthrough each time. Its snapshot provides the overall
step index, Exercise index and within-Exercise progress. The header fraction and
bar share the overall index; at the existing 1100 px desktop breakpoint, an
accessible “In this level” list marks done, current and upcoming Steps.
The design's Level means Module, with one Lesson per Module for now.

`src/curriculum/` owns content, Attempts and deterministic player transitions.
It imports only Table; Scripts contain Robot moves only and never invoke policies.
The learner sits South on North–South; `loadLesson` rejects North declarers until
#16 rotates the table. Script actions carry authored provenance with the Exercise
content ID and version; trial replay preserves each action's provenance.
`src/progress/` owns the append-only session Attempts store (§4.2); the player
appends through curriculum's `AttemptSink` type.

Exposures accumulate in the Exercise player and reset with the next Exercise.
The snapshot's separate `exposed` array contains only named cards still held by
their seat. The screen renders them face up and non-interactively with “Shown for
this lesson”. Seat Views and the Playthrough Record remain unchanged (ADR-0001);
exposures never feed robots or computed outputs. Scripts retain the normal 500 ms
delay. Authored hints retain their content provenance and do not penalize outcomes.

After the final Step, Level complete counts only this run's Attempts: `correct`
as right first time and `corrected` as after a nudge. It shows the Lesson skill
tags without scores, stars, streaks or mastery claims. Both “Next: Practice
following suit” and “That's enough for today” return to practice. There is no
levels map or persistence. Compared with the mock-ups, the fraction is synchronized,
the time estimate and “like a pro” claim are omitted, and the next destination is
practice as specified for #14. UX §6.2's map/next-lesson destinations remain MVP work.

Automated keyboard journeys cover lesson completion, Exposure labels, hidden-card
DOM boundaries and axe in both themes. The owner must still play the full lesson
on both physical reference phones (US-21.7); browser emulation does not replace it.

## Provenance

US-40 / CI-5: `src/coach/provenance.ts` owns the session-only log and validates every
entry on recording. Coach currently depends only on Table. Composition records
rendered reason-code statements and accepted robot actions; later coach features
use the same API. Each entry carries its Playthrough ID, position index, timestamp,
plain-data summary, information mode and source-specific provenance. Robot actions
use source kind `robot` with the host's policy, version, optional fallback reason
and duration. Statements also require rendered text. Source kinds are separate
from the only information modes, `VISIBLE` and `ALL_HANDS`; the design's `RULE`
and `AUTHORED` mode badges are not used.

Use `npm run build:internal` (or the dev server) with `?debug=1`. Audit builds also
support the panel. The production build removes the dynamic panel import. The
panel lists newest entries first, reports hidden-card audit violations and unmarked
`bv-fallback` actions, and can inspect any current Seat View. That deliberately
reveals hidden cards and is restricted to these internal debugging builds.
Internal, audit and development builds must never be served to learners, because
`?debug=1` shows every hand.
Audits report violations into the counter before throwing, so unsafe inputs still
cannot reach a robot. A new Playthrough starts a new log; nothing is persisted.

F5 export is a JSON document with `schemaVersion: 1`, `format: 'bridgevibe-f5'`,
ISO `exportedAt`, `appVersion`, and `entries`. Composition stamps the current package
version as a literal (checked against `package.json` by the composition test), so
the package manifest is not shipped as an undeclared asset. Each exported entry contains
all logged fields plus `grade: null` and `graderNote: null` for teacher completion.
Exports and reads are independent snapshots. The filename is `bridgevibe-f5.json`.

Open question (F5 / VAL-08): teachers should confirm this proposed grading format,
including the vocabulary for `grade` and how two teachers' resolved grades are
combined. Recommendation: retain these nullable fields until the grading rubric
is agreed; do not infer grading values or a sign-off process in this ticket.

## Review and export

US-04, US-16: **Hand review** becomes available only after completion. Table's
`completedRecord()` returns the branded record accepted by `replay` and the review
screen; an incomplete record is refused at runtime too. Replay submits the stored
actions through Table to re-check legality, without consulting robot policies.
Each trick includes its starting hands, play order and winner. The persistent
X-ray note marks the revealed cards; all new copy remains draft (CI-8).

Schema 2 records carry `appVersion`, `engineVersions` and `rulesCoreVersion`.
JSON export/import preserves the entire record and validates its shape and actions.
PBN exports deal, contract and play; it cannot preserve provenance or engine versions.
The current importer accepts complete 13-trick play with undoubled contracts, matching
Table's current contract model. Play columns stay fixed at the `[Play]` seat (PBN
2.1 §3.6), regardless of subsequent trick leaders. `column-order.pbn` is hand-checked:
West leads S2, North wins SA then leads SJ; the second row remains W,N,E,S
(`CK SJ HJ DQ`). North wins all 13 tricks. The other fixtures use `test/strategy.ts`.
The review reuses existing theme tokens; result, trick cost and key moments remain
owned by their separate tickets.

## Analysis

US-17, §4.3.2, U-13: `src/analysis/` owns the `SolverPort` and the completed-record
`doubleDummy` service. Analysis may import Table and `bridge-dds`; Coach may import
Analysis. The service checks `completedRecord()` and replays the record through Table
before reconstructing a position. Legality and trick winners remain Table's decisions.
The port accepts remaining hands and a position with the trick leader, strain and
zero to three cards already played. Position results group equivalent cards and count
remaining tricks for the side to act. Table results use S/H/D/C/NT rows and N/E/S/W
columns. Every result carries the adapter name and version.

The first adapter is `bridge-dds` 1.4.0 (DDS 2.9, Apache-2.0). `App.tsx` starts the
session host when `play.completedRecord()` becomes available, before Hand review is
opened. The host dynamically imports `analysisClient`, which creates `analysisWorker`;
the solver and its embedded WebAssembly live exclusively in that worker chunk.
The lesson route never starts analysis. A build test walks the initial chunk graph,
checks the worker's DDS code and checks its LICENSE attribution; e2e checks the
lesson's requests and the completion trigger. Vite's Node-only `module` import warning
is expected: its browser stand-in is attributed to Vite, including Vite 8's bare ID.
Unknown virtual modules still fail the licence check.

`coach/trickCost.ts` subtracts the chosen equivalence class's value from the best
value for the acting side. One legal card, or just one equivalence class, produces
no statement or badge. Table controller assignments cover South when defending and
both declaring hands when declaring. Each result is logged through the Playthrough's
provenance log as `ALL_HANDS`, engine source, sample count 0. Catalogue text supplies
the hindsight label and engine description; it remains draft pending CI-8 sign-off.
Review subscribes to session results: a static skeleton says “Working out the X-ray
view…” while pending, then badges appear individually (`0` neutral, `−n` X-ray).
The existing review theme tokens are reused; the design's judgement/key-moment copy
is not used for trick costs (CI-3; #26).

The in-memory cache key includes the Playthrough ID, recorded engine versions and
analysis adapter version. Reopening review reuses in-flight or finished work without
duplicate log entries. Workers close after analysis. A 30-second stalled solve
terminates that worker and ends subsequent requests immediately; solve/startup failures
leave badges absent and end the skeleton. User-facing failure states belong to #21.

### F2 smoke references

From the repository root, outside the sandbox, run:

```sh
node scripts/solver/generate-f2.ts
npx vitest run --project node src/analysis src/coach
```

Requirements: Node 24, a C++17 compiler, `.reference-solvers/venv/bin/python` with
endplay 0.5.12, and `.reference-solvers/bridge-solver/` at commit `630705d`.
The generator compiles a small driver against macroxue's public API so mid-trick
positions do not depend on parsing its interactive CLI. It generates 20 `bv-deal-1`
deals with seed `f2-smoke`, indices 1–20, cycling strains and declarers; positions
follow Table's first legal action after `16 + i % 4` and `33 + i % 3` plays (zero-based
`i`). Thus the 40 positions include every current-trick length. Both references score
every legal card; macroxue's total NS result is converted to remaining acting-side
tricks. All 20 tables and 40 per-card arrays must agree. On disagreement the output
preserves both references and the command fails loudly.

`src/analysis/f2-smoke.json` records the endplay and native DDS versions and macroxue's
full commit. It contains no timestamps or timing data, so repeated generation must
be byte-identical. `f2.test.ts` checks the adapter against both references; missing
data is a failure with the regeneration command, never a skipped test. Native DDS
requires a sysctl unavailable in this sandbox: generation and repeatability verification
must run outside it. Reference sources, compiled driver and Matplotlib cache remain
under the Git/ESLint-ignored `.reference-solvers/` directory and are never shipped.
