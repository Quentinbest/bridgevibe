# BridgeVibe: Multi-language Implementation Plan

| Field | Value |
|---|---|
| Status | **Draft v0.1, for owner and engineering lead review** |
| Date | 2026-10-31 |
| Derived from | `docs/i18n/i18n-spec.md` v0.4 (requirements I18N-01 to I18N-23, delivery steps L0a to L4, decisions U-19 to U-27) · the code at `main` 0379dcd |
| Scope | Phase **M**. The MVP ships `en` and `zh-Hans` (D4). `zh-Hant`, `ja` and `es` follow (U-19) |

**How to read this.**

- **Tickets:** the spec's §10 lists the delivery steps. This plan breaks them into tickets of one PR each, each under about 1,000 changed lines (AGENTS.md).
- **Grounding:** each ticket names the files it changes, the requirements it closes, its tests at the engineering spec's seams (§5.2), and what it waits for.
- **Where the code disagrees with the spec,** §7 lists it for approval. Nothing here changes the spec until that approval.
- **Sizes are estimates,** made by reading the code, not by building it.
- **Ticket numbers:** the tickets are not filed yet. Each becomes a GitHub issue, with `lane:i18n` proposed, when the owner names it.

---

## 1. Start conditions

| Condition | Blocks | Status at 0379dcd |
|---|---|---|
| **The technology selection gate,** which fixes the MVP framework (U-08) | Everything except §2's "can start early" tickets | Open. 4 of the 10 gate items are waiting (`docs/reports/phase-v-gate-readiness.md`) |
| **U-25, the message format** | I-03 | Open (engineering lead). The plan assumes the recommended in-house subset |
| **U-26 pipeline approval** (spec §6.6) | I-08, I-09 | Open (engineering lead) |
| **US-35, the Settings screen** (phase M) | I-05 | Not started. No Settings screen or settings store exists yet |
| **US-36, progress persistence** (phase M) | Persisting the choice in I-05 | Not started. Today the app keeps state for the session only |
| **Pipeline sign-off records** (US-26) | I-12 | Not started. Every entry is `status: 'draft'` |
| **A `zh-Hans` bridge teacher** | I-11, I-13 | Not recruited |

**Can start before the gate** (Recommended; the owner decides): I-01, I-02, I-03 and I-06. None of them touches the UI framework, the build output or learner-visible behaviour.

---

## 2. Tickets at a glance

| # | Ticket | Spec step | Closes | Waits for | Size (est.) | Early? |
|---|---|---|---|---|---|---|
| I-01 | Write ADR-0006: locales never change correctness | §11 | proposed ADR-0006 | — | ~60 | Yes |
| I-02 | Split the catalogue and add entry `scope` | L0a | I18N-05, I18N-08 | — | ~750 (mostly moved lines) | Yes |
| I-03 | Message formatter: plural, select, lists, numbers | L0a | I18N-06, I18N-07 | I-02, U-25 | ~450 | Yes |
| I-04 | Locale runtime: state, matching, `lang`, lazy chunks, provenance locale | L0b | I18N-01, I18N-04, I18N-15, I18N-20, I18N-21.1–21.2 | I-03, the gate | ~600 | — |
| I-05 | Settings → Language, and the stored choice | L0b | I18N-02, I18N-03 | I-04, US-35, US-36 | ~300 | — |
| I-06 | Guard: catch non-Latin literals | L0c | I18N-22 | — | ~60 | Yes |
| I-07 | Pseudo-locale `en-XA` and locale end-to-end projects | L0c | I18N-17, I18N-19, I18N-23 | I-04 | ~400 | — |
| I-08 | Font sources: fetch, trim, rename (library and tests) | L0d | I18N-16.4, part of I18N-16.1 | U-26 approval | ~550 | — |
| I-09 | Font plugin, tokens, CI cache, licences | L0d | I18N-16, I18N-21.3 | I-04, I-08 | ~500 | — |
| I-10 | Locale Glossary format and lint | L1 | I18N-09, I18N-18 | I-02 | ~450 | — |
| I-11 | `zh-Hans` Locale Glossary (content) | L1 | I18N-09 for `zh-Hans` | I-10, a teacher | catalogue lines | — |
| I-12 | Per-locale sign-off, integrity tags, shipped-locale list, validity per locale | L4 | I18N-11 to I18N-14 | I-02, pipeline sign-off (US-26) | ~700 | — |
| I-13 | `zh-Hans` catalogue and lesson text: draft, review, sign off, ship | L2 | D4 for MVP | I-03 to I-12 | catalogue lines | — |
| I-14 | `zh-Hant`, `ja`, `es`: one ticket each, as I-11 plus I-13 | L3 | U-19 after the MVP | I-13 pattern, a teacher each | catalogue lines | — |

**Critical path to the MVP:** I-02 → I-03 → I-04 → I-09 → I-13, with I-10 → I-11 and I-12 running alongside. Teacher review in I-11 and I-13 is the longest step (spec R-1).

---

## 3. Tickets

### I-01 Write ADR-0006: locales never change correctness

- **Change:** add `docs/adr/0006-locales-never-change-correctness.md`, in the format of ADR-0004.
  - A locale changes words only.
  - A translation is signed off per locale and never needs a new Content ID.
  - The locale never reaches `table`, `information`, `analysis` or `robots`.
- **Done when:** the owner accepts the ADR. I18N-12 and I18N-15 then cite it.

### I-02 Split the catalogue and add entry `scope`

- **Today:** `src/explanation/index.ts` holds 313 English entries typed `{ text; status: 'draft' }`, plus `text()`, `reasonStrings` and `cardName`.
- **Change:**
  - Move the entries to `src/explanation/locales/en.ts`. `index.ts` keeps the API and derives `StringId` from `en`.
  - The entry type becomes `{ text, status: 'draft' | 'signed', scope: 'learner' | 'internal', source?: 'human' | 'ai-draft', integrity?: true }`.
  - Mark the 23 internal entries `scope: 'internal'`: 11 `bench.*` and 12 `debug.*`. About 290 learner entries remain.
  - Tag as `integrity` the abstention, *uncertain*, sampled-quality and hindsight entries. These are `moment.*-sentence`, `moment.sampled-*`, `moment.uncertain`, `moment.hint-close`, `review.hindsight`, `hint.uncertain`, `hint.unavailable-timeout`, `hint.unavailable-failure` and `hint.not-covered`. The tags are listed in the PR for teacher review.
  - Add `type Catalogue = Record<LearnerStringId, Entry>`, so each later locale is `satisfies Catalogue` (I18N-05.1).
- **Tests:**
  - `src/explanation/catalogue.test.ts`: every entry has a scope.
  - `completeness.test.ts` and `reasons.test.ts` stay green unchanged.
  - A new test: no `internal` key is used in `src/app/**` outside `bench/` and `DebugPanel.tsx` (I18N-08.2).
- **Size:** most of the diff is the 313 moved lines; the PR says so.

### I-03 Message formatter: plural, select, lists, numbers

- **Change:**
  - **The formatter:** `src/explanation/format.ts` implements the U-25 subset: `{name}`, `{n, plural, …}` using `Intl.PluralRules` and `{x, select, …}`, with no dependency. `text()` uses it.
  - **Merge the paired plural keys** into one message each:
    - `moment.heading` and `moment.heading-one`;
    - `home.session` and `home.session-one`;
    - `result.down` and `result.down-one`.

    Update their callers in `src/app`.
  - **Lists:** add `list(items)`, using `Intl.ListFormat` (conjunction), and use it:
    - in `src/app/hints.ts:78` (forced-class cards);
    - in `src/app/LessonScreen.tsx:48` (expected answers).
  - **Numbers:** add `number(n)`, using `Intl.NumberFormat`, for the scores and counts that `result.*`, `home.*` and `tricks` interpolate.
  - **Unchanged on purpose:**
    - `cardName()` (`card.name`) is already one whole template, `{rank} of {suit}`, which a locale can reorder (Chinese `{suit}{rank}`). It only gets golden tests.
    - `hints.ts:25` joins whole sentences with line breaks, which needs no change.
- **Tests:**
  - **Formatter units:** every category of `en`, `es`, `zh-Hans` and `ja`, including `es` `many`.
  - **Placeholder parity:** each entry's placeholders and plural branches are parsed and compared across locales (I18N-06.1). A malformed message fails the test (I18N-06.2).
  - **Lists:** `list` renders `A, B, and C` (`en`), `A、B和C` (`zh-Hans`) and `A, B y C` (`es`).
  - **Composition:** the forced-class hint and the lesson's "show answer" render through `list`.
- **Grep check (I18N-07.2):** a test fails on any `.join(` that joins rendered copy in `src/app`, outside `bench/`.

### I-04 Locale runtime

- **Change:**
  - **`src/explanation/match.ts`:** the §4 matching rules. Skip unmatched preferences; only shipped locales are eligible; fall back to `en` after the whole list.
  - **`src/explanation/index.ts`:** an active-locale holder, `setLocale(tag)` and `currentLocale()`. `text()` reads the active catalogue, so its signature is unchanged (§7, deviation 1).
    - Each non-English catalogue loads through `import()`, so it is its own chunk (I18N-21).
    - `en` stays in the entry chunk.
  - **`src/app/`:**
    - a `LocaleProvider` at the root of `App.tsx` that owns the state and re-renders the tree on change;
    - on change, it sets `document.documentElement.lang` and the document title (I18N-04);
    - live regions are not re-announced (spec §6.3);
    - `index.html` keeps `lang="en"` as the pre-script default.
  - **Provenance:**
    - The `template` kind of `Provenance` in `src/coach/provenance.ts` gains `locale` and `catalogueVersion`.
    - `validateEntry` requires both (I18N-20).
    - **Who fills them in:** template provenance is created in `src/app/play.ts:153` and `:195`, `src/app/hints.ts:66` and `:80`, and `src/coach/uncertainQuality.ts:5`. `coach` may not import `explanation`, so `coach` leaves the fields out. The app's provenance-log wrapper stamps them from `currentLocale()` when an entry is recorded. `test/f5/report.ts` does the same.
    - The debug export's `schemaVersion` stays 1. The fields are additive, as in #108.
  - **`.dependency-cruiser.cjs`:** the current allow-lists already keep `table`, `information`, `analysis`, `robots` and `coach` from importing `explanation`. A test in `test/dependencies.test.ts` pins this, so a later rule change can't open the boundary (I18N-15.1).
- **Tests:**
  - **Matching:** a unit table, including `['fr-FR', 'ja-JP']` → `ja` (I18N-01.1).
  - **Composition:** switching locale mid-Playthrough re-renders the copy, and the Seat View, the trick and the legal cards are unchanged (I18N-02.1, at the seam).
  - **F1 and the determinism suites:** identical Records under `en` and a stub second locale (I18N-15.2).
  - **Provenance:** US-40 completeness includes `locale`.
  - **F5:** `npm run f5:export` is byte-identical apart from the new `locale` field. The PR says so.
  - **Bundle check:** the entry chunk contains no catalogue other than `en` (I18N-21.1).
- **Note:** this ticket ships no second locale to learners. A test-only stub catalogue proves the mechanism.

### I-05 Settings → Language, and the stored choice

- **Change:**
  - **The Language row** (UX §9): endonyms, no flags, ticked current locale. It is added inside the US-35 Settings screen.
  - **The stored choice:** saved with the other settings in the US-36 store, and added to `ProgressExport.settings`, with the `schemaVersion` bump and migration (spec §6.4).
  - **Import:** importing an unshipped locale falls back to matching (I18N-03.2).
- **Tests:** end-to-end:
  - switching language mid-trick (I18N-02.1);
  - the choice surviving export and import (I18N-03.1).
- **If US-35 is late:** I-04's matching still gives learners their device language. Only the manual choice waits.

### I-06 Guard: catch non-Latin literals

- **Change:** `test/catalogue.test.ts:24` treats a literal as phrase-like only when it contains a space. Also flag any literal containing Han, Kana or Hangul (`\p{Script=Han}`, `\p{Script=Hiragana}`, `\p{Script=Katakana}`, `\p{Script=Hangul}`).
- **Tests:** the guard's own test cases gain `const label = '继续'` and a Kana literal, both expected to fail (I18N-22.1).

### I-07 Pseudo-locale and locale end-to-end projects

- **Pseudo-locale:** `en-XA` is generated from `en` at build time, in non-production modes only:
  - accented letters;
  - +40% length;
  - `⟦ ⟧` brackets around each entry.

  The production build fails if `en-XA` is present (I18N-23.1).
- **Playwright:**
  - **Why a separate folder:** the 19 existing specs use 186 locators that match literal English text, so they keep running under `en` only (§7, deviation 2).
  - **The new projects:** `es-390`, `ja-390` and `en-XA-320` run only `test/e2e/locale/*.spec.ts`, selected with `testMatch`.
  - **What those specs check:**
    - the device-language landing (I18N-01.2);
    - `<html lang>`;
    - no horizontal overflow or clipped text on the table, result, review, hint and lesson screens;
    - targets of at least 44 px;
    - axe (I18N-17.2, I18N-19.1).
  - **Stub catalogues:** until `es` and `ja` exist, these projects use stub catalogues sized at +30% and CJK sample text.
- **Tests:** the new specs themselves; the existing projects are unchanged.

### I-08 Font sources: fetch, trim, rename

- **Fetch:**
  - `scripts/fonts/sources.json` pins `@ibm/plex-sans-sc` 1.1.0, `@ibm/plex-sans-tc` 1.1.1 and `@ibm/plex-sans-jp` 3.0.0, each with its `sha512` integrity from the registry.
  - `scripts/fonts/fetch.ts` downloads each tarball from `registry.npmjs.org`, checks the hash and extracts only `fonts/complete/woff2/hinted/*-{Regular,SemiBold}.woff2` into the git-ignored `.font-sources/`.
  - It runs no package scripts and imports no package code (spec §6.6, R-8).
- **Trim and rename** (`scripts/fonts/subset.ts`):
  - **Inputs:** a source font and a character set.
  - **Trim:** cut the font with `subset-font` 2.9.0, added as a development dependency (BSD-3-Clause; harfbuzzjs is MIT). Keep the default layout features.
  - **Rename:** rewrite `name` records 1, 3, 4, 6, 16 and 17 (and 21, 22 and 25 if present) to `BridgeVibe Sans SC`, `TC` or `JP`. Keep records 0, 7, 13 and 14. Recompute the checksums.
  - **Output:** WOFF2.
- **Tests (Node):**
  - **Fixture:** a small font file committed as a fixture under `test/fonts/`, so the tests need no network.
  - **Names:** after renaming, no renamed record contains "Plex", and records 0, 7, 13 and 14 are unchanged (I18N-16.4).
  - **Determinism:** the same input gives the same bytes.
  - **Glyphs:** a requested character missing from the source is reported, with its code point.
- **`package.json`:** add a `fonts:fetch` script. `.gitignore` gains `.font-sources/`.

### I-09 Font plugin, tokens, CI cache, licences

- **Vite plugin** (`scripts/fonts/plugin.ts`), run in `serve` and `build` (including `audit` and `internal`):
  - **Characters, per shipped CJK locale:** every `learner` entry, including every plural and select branch, plus printable ASCII, the CJK punctuation set and the locale's `Intl.ListFormat` and `Intl.NumberFormat` output.
  - **Excluded:** `symbol.*` and `face.*`, which render with `--font-suit`; they are checked against the suit set instead.
  - **Output:** trim with I-08 and emit hashed assets plus `@font-face` CSS into the locale's lazy chunk.
  - **Licence attribution:** emit with `originalFileName` set to the `.font-sources/` source, so the licence plugin attributes it.
- **Build failures:**
  - a catalogue character with no glyph, naming the key (I18N-16.1);
  - a file over 500 KB (I18N-21.3);
  - a missing `.font-sources/`, with the message "run `npm run fonts:fetch`".
- **Tokens:**
  - `src/app/tokens.css` gains `--font-suit`, equal to today's body stack, and the `:root:lang(…)` overrides (spec §6.5).
  - `src/app/styles.css`: the card, suit symbol and led badge use `--font-suit`; CJK display text gets `letter-spacing: 0`; CJK line heights are at least 1.3 for headings and 1.7 for body.
- **Licences:**
  - the IBM OFL texts are committed in `public/licences/fonts/`;
  - `licences/assets.json` declares each `.font-sources/…` source with its attribution: "BridgeVibe Sans SC: Modified Version of IBM Plex Sans SC 1.1.0, © IBM Corp., OFL-1.1".
- **CI** (`.github/workflows/ci.yml`):
  - an `actions/cache` step for `.font-sources/`, keyed on `hashFiles('scripts/fonts/sources.json')`;
  - `npm run fonts:fetch` before `npm run build`, because the e2e web server also builds (`--mode audit`).
- **Docs:** the `docs/development.md` "Theme and fonts" section describes the stacks, how to bump a source, and why the fonts are renamed.
- **Tests:**
  - screenshots in the I-07 projects show no missing-glyph boxes (I18N-16.2);
  - the licence check lists each modified font (I18N-16.3);
  - two builds give identical font hashes.
- **Before `zh-Hans` exists:** the plugin runs against the I-07 stub catalogue, so the pipeline is proven before translation starts.

### I-10 Locale Glossary format and lint

- **The glossary file:** `src/explanation/glossary/<tag>.ts` holds, for each term in `GLOSSARY.md`:
  - the approved translation;
  - its *avoid* terms, each listing the approved terms that contain it (ノートランプ for トランプ);
  - the register and the length limit (I18N-18).
- **The lint** (`src/explanation/glossary.test.ts`, US-34.2):
  - per locale, it fails when a `learner` entry uses an *avoid* term;
  - for `zh-*` and `ja`, it matches by substring after removing the approved compounds;
  - it warns above the length limit.
- **Tests:** the lint accepts ノートランプ and rejects a lone トランプ (I18N-09.3).

### I-11 `zh-Hans` Locale Glossary (content)

1. Start from spec §7. An AI draft is allowed and recorded as `source: 'ai-draft'` (U-24).
2. The `zh-Hans` teacher reviews every term, the register and the length limit.
3. The teacher signs off (CI-8). Every entry stays `draft` until then.
4. This must be done before I-13 starts translating.

### I-12 Per-locale sign-off, integrity, shipped locales, validity per locale

- **Sign-off records:**
  - **Keys:** sign-off records are keyed by content ID, version and locale (`SignOff.locale`, spec §6.4), in the US-26 pipeline store.
  - **`ai-draft` entries:** signing one off requires the reviewer's confirmation (I18N-13).
  - **`integrity` entries:** signing one off requires answers to the certainty checklist and an attached English back-translation (I18N-14.2).
- **The shipped-locale list:**
  - The build derives it from the sign-off records. A locale with any unsigned `learner` entry, lesson text or glossary is not listed (I18N-11.1).
  - Non-production builds show unshipped locales with a "preview" marker and English fallback (I18N-11.2).
  - `match.ts` (I-04) reads this list.
- **Validity per locale:** `scripts/content/check.ts` runs `validateLesson` once per shipped locale, with that locale's key set and text. `src/pipeline/validate.ts` already takes the key set from its caller, so the dependency rules don't change (I18N-12.1).
- **Tests:**
  - a pipeline test where a `ja` commentary refers to a card the Script doesn't expose fails in `ja` only;
  - a schema check for `source`;
  - checklist enforcement.

### I-13 `zh-Hans` catalogue and lesson text

1. **AI draft:** `src/explanation/locales/zh-Hans.ts`, typed `satisfies Catalogue`, from the signed-off glossary (U-24, recorded per entry).
2. **Teacher review:**
   - the `zh-Hans` teacher reviews every `learner` entry and the lesson text;
   - `integrity` entries get the checklist and a back-translation (I18N-14).
3. **Checks:** the build passes I18N-05 parity, I18N-06 placeholders, I18N-09 lint, I18N-16 coverage and I18N-17 layouts in a `zh-Hans-390` project, which is added here.
4. **Sign-off:** recorded per entry. When complete, `zh-Hans` appears in the shipped-locale list (I-12), and matching serves it to `zh-CN` devices.

The PR lists the changes made at teacher review and states that the copy is signed off for `zh-Hans` only.

### I-14 After the MVP: `zh-Hant`, `ja`, `es`

One ticket per locale, each repeating I-11 and I-13 with its own teacher, independently:

- `zh-Hant`: Taiwan terminology (U-21);
- `es`: `es-419` (U-20);
- `ja`: its register is decided by U-22.

U-23 (card-face letters and abbreviations) is decided in each locale's glossary.

---

## 4. Order and parallel work

```
early ─ I-01 ADR ─┐
       I-02 ─ I-03 ┼─ (gate) ─ I-04 ─┬─ I-07 ─┐
       I-06 guard  │                 ├─ I-09 ─┼─ I-13 zh-Hans ─ MVP ─ I-14 ×3
                   │   I-08 (U-26) ──┘        │
                   └─ I-10 ─ I-11 (teacher) ──┤
                       I-12 (after US-26) ────┘
                       I-05 (after US-35/36), any time before the MVP
```

- **Engineering, I-01 to I-10 and I-12:** about 4,800 changed lines across 11 PRs.
- **Teacher work:** I-11 and I-13 for the MVP. Then three more glossaries and catalogues after it.

## 5. Checks every ticket keeps

- **Checks:** `npm run check` green before each commit, and CI green after each push. Codex findings are answered in their threads (AGENTS.md).
- **English:** the existing `en` tests, the e2e suite and the F5 export keep passing unchanged, except where a ticket states the change. Example: I-04 adds `locale` to provenance.
- **Copy:** all copy stays `draft` until a teacher signs it off. A PR never presents AI-drafted copy as approved.

## 6. Risks found while planning

| Risk | Where | Mitigation |
|---|---|---|
| **A re-render on locale switch drops in-flight state,** such as a hint request or review sampling | I-04 | Keep state above the provider. The switch-mid-trick test also covers a pending hint |
| **The font plugin slows `npm run dev`** | I-09 | Trim on catalogue change only, with a cache keyed on the character set |
| **The `name`-table rewrite corrupts a font** | I-08 | Validate the output with harfbuzzjs (re-open it and check its glyph count), plus the fixture tests |
| **The provenance field change breaks the F5 sheet the teachers already have** | I-04 | The CSV has no locale column. Only the JSON gains a field, so the sheet stays byte-identical |
| **The stub catalogues hide real-length problems** | I-07, I-09 | The `zh-Hans-390` project in I-13 re-runs the layouts on real text before shipping |

## 7. Where the code differs from the spec (for approval)

1. **`text()` keeps its signature** (spec §6.1 says "`text()` takes a locale; components read it from context").
   - **Today:** about 295 calls in 21 source files use `text()`, and non-React modules (`play.ts`, `hints.ts`) render copy too.
   - **Proposed:** an active locale inside `explanation`, set only by the app's `LocaleProvider`, with an optional explicit `locale` argument for tests and exports.
   - **Cost:** the explicit-argument version would touch every call site for no behavioural gain.
   - **Approver:** engineering lead.
2. **The locale end-to-end projects run their own spec folder** (I18N-17.1 names the projects but not the specs). The existing specs match literal English text in 186 locators, so they stay `en`-only.
3. **I18N-15.1 needs no new dependency rule.** The current allow-lists already block those imports, so I-04 adds a test that pins them instead.
4. **`cardName` needs no change** (spec §2 listed it with the fragment builders). `card.name` is already one template, `{rank} of {suit}`, and a locale can reorder it.
5. **The Language row depends on US-35,** and its persistence on US-36. Neither exists yet. Device matching (I-04) works without them.
6. **The locale is stamped where provenance is logged, not where it's created** (spec §6.4 and I18N-20 don't say where). `coach` creates template provenance (`uncertainQuality.ts`) but may not depend on `explanation`, so the app's log wrapper adds `locale` and `catalogueVersion`.

Once approved, these go into the i18n spec as v0.5.
