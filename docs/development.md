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
| `npm run build` | Production Vite build |
| `npm run test:e2e` | Playwright with axe; builds first, then serves `vite preview` on 127.0.0.1:4173 |
| `npm run check` | All of the above, in CI order |

- One Vitest test: `npx vitest run --project node <file>`, with `-t "<name>"` to filter by test name.
- One Playwright project: `npx playwright test --project 390-dark`. Projects are `<width>-<light|dark>` for widths 320, 390, 600 and 1440.

CI (`.github/workflows/ci.yml`) runs each check as its own step.

## Modules

`src/<module>/` follows engineering spec §4.2: one module per bounded context, created by the ticket that needs it. Today there are four:

- **table**: the authoritative rules core. `startPlaythrough({ deal, contract })` returns a handle with `legalActions(seat)`, `submit(seat, controller, action)`, `seatView(seat)` and `record()`. It checks card plays, owns turns and trick winners, exposes Dummy after the opening lead, and completes after 13 tricks. Rejections preserve all state. It **may depend on nothing**: no other module, package or Node builtin (its tests may import Vitest).
- **robots**: deterministic fallback card policy (§4.6.6), receiving only a branded `SeatView`. It imports only Table. ESLint prohibits full-Deal types and SeatView assertions outside Table.
- **explanation**: the string catalogue (`catalogue` keyed by ID, `text(id, params)` with `{param}` interpolation). Every entry carries `status: 'draft'` until a teacher signs it off (CI-8).
- **app**: the composition root and all UI. Only **app** may import **app**.

`.dependency-cruiser.cjs` enforces the module rules, and `test/dependencies.test.ts` proves each rule fails on the fixtures in `test/fixtures/`. When a ticket adds a module, add its §4.2 rule and a failing fixture for it.

Rules every later module must keep:

- The Table is the only authority on rules: the UI and robots only submit actions (INV-1).
- Robots and in-play hints receive only a Seat View, never a full Deal. Only **table** constructs Seat Views and completed playthrough records (ADR-0001).
- The UI is built from a learner view: face-up cards plus a count for each hidden hand. No hidden card identity reaches React props, page text or accessibility names (US-16.4). The fixed Deal lives in `src/app/fixture.ts` for composition; `src/app/play.ts` projects South’s SeatView into the learner view. The authored Deal is necessarily present in the client bundle in this fixed-Deal slice.
- When the learner's side declares, the learner plays Declarer, and the display rotates so Declarer is at the bottom (ADR-0003).
- Robots run on the main thread for issue #2, with 500 ms `setTimeout` delays and a 1 s trick collection delay. Workers arrive with #8.

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
