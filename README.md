# BridgeVibe

A static bridge table showing one fixed Deal: South declares 3NT, North is Dummy, and neither Side is vulnerable. Cards are display-only. Copy is English and awaits teacher sign-off. The theme follows the device setting; fonts are self-hosted with notices in `public/licences/fonts/`.

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
| `npm test` | Node unit tests, jsdom Card tests, catalogue guard and dependency-rule fixtures |
| `npm run test:browser` | Table tests and Card colour tests in headless Chromium |
| `npm run build` | Production Vite build |
| `npm run test:e2e` | Built app in Chromium at 320×568, 390×844, 600×900 and 1440×900, each light/dark; axe and layout checks |
| `npm run check` | All checks above, in that order |

The end-to-end runner builds the app before starting `vite preview`, so standalone runs always test fresh output. GitHub Actions runs each check separately on pushes and pull requests.

`src/table/` owns immutable Card, Hand, Seat and Deal types and ordered lists; it imports no other module.
`src/explanation/` owns draft catalogue entries and interpolation; it may import Table types.
`src/app/` owns composition, UI, fixture and theme; it may import both modules, and no other module may import it.

Open `docs/design/BridgeVibe UI.html` directly in a browser to view the design gallery.
