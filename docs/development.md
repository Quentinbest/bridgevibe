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

`src/<module>/` follows engineering spec §4.2: one module per bounded context, created by the ticket that needs it. Today there are three:

- **table**: the authoritative rules core. For now it holds only types (`Card`, `Suit`, `Rank`, `Seat`, `Hand`, `Deal`) and the `as const` lists they derive from. It **may depend on nothing**: no other module, package or Node builtin (its tests may import Vitest).
- **explanation**: the string catalogue (`catalogue` keyed by ID, `text(id, params)` with `{param}` interpolation). Every entry carries `status: 'draft'` until a teacher signs it off (CI-8).
- **app**: the composition root and all UI. Only **app** may import **app**.

`.dependency-cruiser.cjs` enforces the module rules, and `test/dependencies.test.ts` proves each rule fails on the fixtures in `test/fixtures/`. When a ticket adds a module, add its §4.2 rule and a failing fixture for it.

Rules every later module must keep:

- The Table is the only authority on rules: the UI and robots only submit actions (INV-1).
- Robots and in-play hints receive only a Seat View, never a full Deal. Only **table** constructs Seat Views and completed playthrough records (ADR-0001).
- The UI is built from a learner view: face-up cards plus a count for each hidden hand. No hidden card identity reaches the UI, its page or its bundle before the playthrough is completed (US-16.4). Until the Table builds Seat Views, the static screen's `learnerView` in `src/app/fixture.ts` stands in for one, and the full Deal lives only in `src/app/fixture.test.ts`.
- When the learner's side declares, the learner plays Declarer, and the display rotates so Declarer is at the bottom (ADR-0003).
- Every engine (solver, sampler, robot policy, bidding) runs in a Web Worker behind a port interface.

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
- **Below 720 px:** two suit columns.
- **Below 356 px:** one suit per row.

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
