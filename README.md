# BridgeVibe

Play one fixed Deal: South declares 3NT, North is Dummy, and neither Side is vulnerable. Choose cards for South and Dummy against deterministic fallback robots. Tap a card to raise it, then tap again or choose **Play it**. Arrow keys move focus; Enter or Space raises then plays; Escape lowers the card. Copy is English and awaits teacher sign-off. The theme follows the device setting; fonts are self-hosted with notices in `public/licences/fonts/`.

Use Node 24. Install the pinned dependencies and Chromium:

```sh
npm ci
npx playwright install chromium
```

Start the development server with `npm run dev`. Build with `npm run build`, then serve the build with `npm run preview`.

Run checks from the repository root:

| Command | Check |
| --- | --- |
| `npm run typecheck` | Strict TypeScript across source, tests and TypeScript configs; no emit |
| `npm run lint` | ESLint, React Hooks and refresh rules |
| `npm run deps:check` | Source module boundaries, including type imports |
| `npm test` | F1 rules, fallback policy, full Deal and timer composition tests, jsdom components, catalogue and boundary guards |
| `npm run test:browser` | Table tests and Card colour tests in headless Chromium |
| `npm run build` | Production Vite build |
| `npm run test:e2e` | Built app in Chromium at 320×568, 390×844, 600×900 and 1440×900, each light/dark; axe, layout, keyboard, rejection and hidden-card checks; full Deal at 390-light and 1440-dark |
| `npm run check` | All checks above, in that order |

The end-to-end runner builds the app before starting `vite preview`, so standalone runs always test fresh output. GitHub Actions runs each check separately on pushes and pull requests.

`src/table/` is the sole authority on turns, legal plays, trick winners and completion. `startPlaythrough({ deal, contract })` returns `legalActions(seat)`, `submit(seat, controller, action)`, `seatView(seat)` and `record()`. Rejections leave state unchanged; Dummy is exposed after the blind opening lead. It imports no other module.
`src/robots/` chooses fallback cards using only a branded `SeatView` and imports only Table.
`src/explanation/` owns draft catalogue entries and interpolation; it may import Table types.
`src/app/` owns composition, UI, fixture and theme; it drives the Table and robots on timers, and no other module may import it.

Open `docs/design/BridgeVibe UI.html` directly in a browser to view the design gallery.
