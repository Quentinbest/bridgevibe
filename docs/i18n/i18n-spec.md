# BridgeVibe: Multi-language Specification

| Field | Value |
|---|---|
| Status | **Draft v0.1, for owner, engineering lead and teacher review** |
| Date | 2026-10-30 |
| Requested by | The owner, 2026-10-30: add Simplified Chinese, Traditional Chinese, Japanese and Spanish |
| Derived from | `docs/PRD.md` §10.4 (NFR-I), §18 D4 · `docs/engineering/engineering-spec.md` §4.2, §4.4, §4.9, §7.3 · `docs/ux/ux-spec.md` §9–§11 · `GLOSSARY.md` §10 · ADR-0001, ADR-0004 · `src/explanation/index.ts` |
| Scope | Phase **M**. Phase V stays English-only (PRD §13.3) |

**Conventions.** These follow the engineering specification.

- **Decision status:**
  - **Confirmed:** already stated by the PRD, an ADR or the glossary. Cited.
  - **Proposed:** made here. The engineering lead approves it, or replaces it before the work starts.
- **IDs:**
  - Requirements are `I18N-nn`, and acceptance checks are `I18N-nn.k`.
  - Decisions that need approval continue the engineering specification's list from **U-19** (§11). Once accepted, they move to its §7.3.
  - The proposed ADR is **ADR-0006**, because ADR-0005 is already reserved for rotation (UX P-2).
- **Locale tags** are BCP 47: `en`, `zh-Hans`, `zh-Hant`, `ja`, `es`.
- **Words** are the glossary's. A *Playthrough* is still never a "hand" or "game", in any language.
- **Bridge terms in other languages** (§7) are drafts by Claude. None is approved, and every term needs sign-off from a teacher who plays bridge in that language (CI-8, US-26.4).

---

## 1. Summary

BridgeVibe will offer five languages: English, Simplified Chinese, Traditional Chinese, Japanese and Spanish. A learner gets their device language on first launch, if it is offered, and can change it in Settings at any time. Changing it never touches the Table, the Records or correctness.

**A language is offered only when it is complete and signed off:**

- every learner-facing string;
- every lesson text;
- the language's Locale Glossary.

Bridge words differ by language and region. For example, Taiwan says 無王 for no-trumps, while mainland China says 无将. So each locale is translated and reviewed on its own, with no automatic conversion from one to another. Most of the code work is plumbing that phase V deferred; most of the cost is teacher time.

## 2. Problem

- **Some of the design is already in place:**
  - **Confirmed:** strings are externalised (NFR-I), with one Locale Glossary per language (FR-E5).
  - **Confirmed:** the Settings screen has a Language row (UX §9).
  - **Confirmed:** every reason code needs a template "in each shipped locale" (US-01.9).
  - **Open:** the launch languages are decision D4, "before MVP content production".
- **The code is English-only in ways the externalisation does not fix:**
  - **One catalogue:**
    - `src/explanation/index.ts` holds one English catalogue of 313 entries, all `status: 'draft'`.
    - `text()` replaces `{name}` placeholders and nothing else.
  - **Plurals are separate keys** (`moment.heading` / `moment.heading-one`, `home.session` / `home.session-one`):
    - This works for English only.
    - Spanish has three CLDR categories (`one`, `many`, `other`), while Chinese and Japanese have one (`other`).
  - **Sentences are glued together from fragments:**
    - `cardName()` builds "{rank} of {suit}" from separate words.
    - `src/app/hints.ts:78` joins card names with `', '`.
    - Chinese wants 红心A, with no "of", and lists with 、.
  - **Latin-only page and fonts:**
    - `index.html` hard-codes `lang="en"`.
    - The self-hosted fonts (Bricolage Grotesque, IBM Plex) have no CJK glyphs.
  - **A gap in the US-38 string guard:**
    - Its phrase check (`test/catalogue.test.ts:24`) needs whitespace, so a CJK phrase kept in a constant passes.
    - JSX text and protected attributes are still caught.
  - **Provenance has no locale:**
    - A template statement's provenance records `templateId` only (`src/coach/provenance.ts:12`).
    - The `Statement` entity requires a locale (engineering spec §4.4).

## 3. Goals and non-goals

**Goals**

1. A learner can complete every MVP journey (first launch, lessons, practice, hints, review, settings) in any shipped locale.
2. **Coaching integrity holds in every language.** No translation claims more certainty than the English template, or drops a hindsight label (CI-1 to CI-3).
3. Each locale can ship on its own, when it is complete and signed off. No locale blocks another.
4. English learners see no slower first load and no change in behaviour.

**Non-goals**

- Right-to-left languages. None is requested; §10 lists what keeps them possible.
- **A bidding system per locale.** D1 (a SAYC-based profile) applies in every language, even where Precision or other systems are common locally (§12, R-6).
- Translating internal tools: the device benchmark (`bench.*`) and the developer provenance panel.
- Language-model phrasing at run time (D7). Translation drafting by AI is a separate question (U-24).
- Server-side localisation, content delivery networks, or downloading locales after release.

## 4. Locales

| Tag | Endonym in picker | Target audience | Matches these device languages | Plural categories | Notes |
|---|---|---|---|---|---|
| `en` | English | Source locale | `en-*`, and anything unmatched | one, other | Source of every key |
| `zh-Hans` | 简体中文 | Mainland China | `zh-CN`, `zh-SG`, `zh-Hans-*`, bare `zh` | other | Already the D4 candidate |
| `zh-Hant` | 繁體中文 | Taiwan (U-21) | `zh-TW`, `zh-HK`, `zh-MO`, `zh-Hant-*` | other | Its own glossary; **not** a script conversion of `zh-Hans` |
| `ja` | 日本語 | Japan | `ja-*` | other | Register: U-22 |
| `es` | Español | One region, to be chosen (U-20) | `es-*` | one, many, other | Terms differ between Spain and Latin America |

**Matching (Proposed):**

1. Walk `navigator.languages` in order. Take the first entry that maps, by the table above, to a locale that has **shipped**.
2. If none maps, use `en`.
3. A learner's explicit choice in Settings always overrides the device language.

## 5. Requirements

### 5.1 Choosing a language

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-01 | On first launch, the locale comes from the device language by the §4 matching rules. Only shipped locales are eligible | I18N-01.1 A unit table test covers every row of §4, plus an unmatched language and a matched but unshipped one. I18N-01.2 An end-to-end test with Playwright `locale: 'ja-JP'` lands in Japanese |
| I18N-02 | **Settings → Language:** <br>• lists the shipped locales by endonym, with no flags; <br>• applies a change at once, without a reload, including mid-Playthrough; <br>• keeps the current Playthrough's state, focus and position | I18N-02.1 An end-to-end test switches language mid-trick. The Seat View, the trick and the legal cards are unchanged, and the visible copy is in the new locale |
| I18N-03 | The choice is stored with the other settings: for the session in V, and persisted in M. It is part of `ProgressExport.settings` (FR-P4) | I18N-03.1 Export and import keep the locale. I18N-03.2 Importing an unshipped locale falls back to the §4 matching rules |
| I18N-04 | `<html lang>` and the document title follow the locale. Text in another language, such as English in the internal provenance panel, carries its own `lang` | I18N-04.1 An end-to-end check of `document.documentElement.lang` per locale |

### 5.2 Catalogue and message format

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-05 | **One catalogue per locale, all keyed by the same `StringId`s.** English is the source. A shipped locale missing any learner-facing key fails the build. This extends US-01.9 from reason codes to every key | I18N-05.1 The type check fails on a missing key in a shipped locale. I18N-05.2 The existing reason-code completeness tests run for every shipped locale |
| I18N-06 | **The same placeholders in every locale.** Each entry uses exactly the placeholder names of its English source. A plural entry covers every CLDR category of its locale (`Intl.PluralRules(locale).resolvedOptions().pluralCategories`) | I18N-06.1 A test parses every entry in every locale and compares placeholder sets and plural branches. I18N-06.2 A malformed message fails the test, not the runtime |
| I18N-07 | **No sentence is built from translated fragments.** <br>• Card names, seat phrases and results are whole templates with placeholders. <br>• Lists use `Intl.ListFormat`. <br>• Numbers and signed scores use `Intl.NumberFormat`. <br>• The paired `-one` keys become one plural message | I18N-07.1 `cardName`, the forced-class hint list, `result.*`, `moment.heading` and `home.session` render correctly in all five locales. I18N-07.2 A grep check finds no `.join(` on rendered copy in `src/app` |
| I18N-08 | **Every entry has a scope:** `learner` or `internal`. Only `learner` entries are translated, signed off and checked for completeness. `bench.*` and the debug panel's entries are `internal` and stay English | I18N-08.1 The completeness test skips `internal`. I18N-08.2 No `internal` key renders on a learner screen (a composition test) |

### 5.3 Bridge terminology

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-09 | **A locale's Locale Glossary comes first.** It is drafted and signed off before any other string in that locale is translated (FR-E5, GLOSSARY §10). It maps every glossary term and every teenage-register word, and lists *avoid* terms. One example: in Japanese, トランプ means playing cards, so it can't stand alone for "trump" | I18N-09.1 The lint (US-34.2) runs per locale. I18N-09.2 For `zh-Hans`, `zh-Hant` and `ja`, it matches by substring, because there are no word boundaries |
| I18N-10 | **Bridge notation is copy.** Strain abbreviations (NT), seat letters (in Spanish, W is O for *Oeste*), card-face letters and level-and-strain call labels all come from the catalogue. Suit symbols ♠♥♦♣ are the same in every locale, and always have a localised accessible name | I18N-10.1 Golden render tests for a card, a contract and a call label in every locale. I18N-10.2 No suit-symbol-only element lacks an accessible name (axe, plus the existing card tests) |

### 5.4 Content and sign-off

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-11 | **A locale ships only when it is fully signed off.** Every `learner` entry, every lesson text and its Locale Glossary are signed off by a teacher who knows bridge in that language (CI-8, US-26.4). <br>• A shipped locale never falls back to English for learners. <br>• Development and test builds may show an unshipped locale, with English fallback and a visible "preview" marker | I18N-11.1 The build's shipped-locale list is derived from the sign-off records. A locale with an unsigned `learner` entry can't be listed. I18N-11.2 The preview marker exists only in non-production builds |
| I18N-12 | **Translation never changes correctness.** This extends ADR-0004 to locales (proposed ADR-0006). <br>• A translation keeps the content ID, expected answers, Deal and Script. <br>• Each locale's text has its own sign-off, keyed by content ID, version and locale. <br>• The validity check "expected answers consistent with the prose" (US-27.4) runs for every locale | I18N-12.1 Pipeline test: a lesson whose `ja` commentary refers to a card the Script doesn't expose fails validation in `ja` only |
| I18N-13 | **Every translated entry records its source:** `human`, or `ai-draft` if U-24 allows it. An `ai-draft` entry can't be signed off unchanged without the reviewer confirming it | I18N-13.1 Schema check on the source field. Sign-off records carry it |

### 5.5 Coaching integrity across languages

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-14 | **Translations keep the same certainty.** <br>• Templates for abstentions, *uncertain*, sampled quality and hindsight (CI-1 to CI-3, INV-5 to INV-7) are tagged `integrity`. <br>• Their sign-off checklist asks whether the translation claims no more certainty than the English, and keeps the hindsight label. <br>• Teachers get an English back-translation of each `integrity` entry with the review | I18N-14.1 Every hindsight statement renders `review.hindsight` (or its key) in every locale (a composition test). I18N-14.2 Sign-off of an `integrity` entry without the checklist answered is rejected |
| I18N-15 | **Localisation never decides.** It sees only rendered facts, abstentions and reason codes (engineering spec §4.2, rule 4). The locale never reaches the Table, robots or analysis | I18N-15.1 A dependency-cruiser rule: `table`, `information`, `analysis` and `robots` can't import the locale module. I18N-15.2 F1 and determinism suites give identical Records under every locale |

### 5.6 Typography, layout and accessibility

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-16 | **CJK text uses the system's CJK fonts** (Proposed, U-26). <br>• Per-`lang` font stacks: `zh-Hans`: PingFang SC, Noto Sans CJK SC, Microsoft YaHei; `zh-Hant`: PingFang TC, Noto Sans CJK TC, Microsoft JhengHei; `ja`: Hiragino Sans, Noto Sans CJK JP, Yu Gothic, Meiryo; each then `sans-serif`. <br>• The brand fonts stay first for Latin glyphs. <br>• Nothing loads from a CDN. <br>• Correct `lang` makes unified Han characters take their regional shapes | I18N-16.1 Screenshot tests show no missing-glyph boxes in each CJK locale. I18N-16.2 The licence check is unchanged, because no font is added |
| I18N-17 | **Layouts hold at 320 and 390 px** for every shipped locale and for the pseudo-locale (I18N-23): <br>• no clipped or truncated text; <br>• touch targets of at least 44 px; <br>• the two-row hand rule unchanged. <br>CJK lines break by character, and `ja` uses `word-break: auto-phrase` where the browser supports it | I18N-17.1 Playwright projects for `es` and `ja` at 390 (the longest and the tallest), and the pseudo-locale at 320. I18N-17.2 axe passes in every locale |
| I18N-18 | **Length rules per locale.** UX §11 says "at most about 15 words". That rule doesn't apply to CJK, so each Locale Glossary states its own limit in characters, set by the teacher | I18N-18.1 A content lint warns above the limit |
| I18N-19 | **Accessible text is localised too:** accessible names, live announcements ("East plays the 9 of hearts") and rejection messages | I18N-19.1 The existing a11y tests run in `zh-Hans` and `es` as well as `en` |

### 5.7 Provenance, export and performance

| ID | Requirement | Acceptance |
|---|---|---|
| I18N-20 | **Provenance records the locale.** <br>• A template statement's provenance has `locale` and the catalogue version, as well as `templateId` (CI-5, `Statement.locale`). <br>• Logged statements keep the locale they were rendered in, even after a switch. <br>• The F5 export carries the locale, so teachers grade in their own language | I18N-20.1 US-40 provenance completeness includes `locale`. I18N-20.2 An F5 export in `zh-Hans` is deterministic |
| I18N-21 | **Locales load only when needed.** Each non-English catalogue is its own lazily loaded chunk. The English first load stays within NFR-P1, with no extra bytes on the critical path. Offline use (NFR-C3) caches the selected locale | I18N-21.1 A bundle check: the English entry chunk has no other catalogue. I18N-21.2 Switching locale offline after first use works |
| I18N-22 | **The US-38 guard also catches non-Latin text.** A literal with any Han, Kana or Hangul character counts as phrase-like without needing a space | I18N-22.1 A guard test with `const label = '继续'` fails |
| I18N-23 | **A pseudo-locale for development only** (`en-XA`): accented letters, +40% length, and brackets around each entry. It catches hard-coded text and layout overflow before translation starts. It is never shipped | I18N-23.1 Production build has no `en-XA`. I18N-23.2 The 320-px pseudo-locale project passes |

## 6. Implementation decisions (Proposed)

### 6.1 Where it lives

**The `explanation` module owns locales** (engineering spec §4.2):

- the catalogues;
- the formatter;
- the matching rules;
- the Locale Glossaries.

**`app` owns the rest:**

- the current-locale state;
- the `lang` attribute;
- loading the chunk.

No other module gains a dependency.

```
src/explanation/
  index.ts            text(), types, StringId (from en)
  locales/en.ts       source catalogue (today's entries move here)
  locales/zh-Hans.ts  satisfies Catalogue<StringId>
  locales/zh-Hant.ts
  locales/ja.ts
  locales/es.ts
  glossary/<tag>.ts   Locale Glossary, including avoid terms
  format.ts           message formatter
  match.ts            device-language matching (§4)
```

- **Key parity is checked by the compiler.** Each translation is typed `satisfies Record<LearnerStringId, Entry>`, the same pattern the reason-code entries use today.
- **The entry shape grows:** `{ text, status: 'draft' | 'signed', scope: 'learner' | 'internal', source, integrity? }`.
- **`text()` takes a locale.** Components read it from context, not as an argument at every call.

### 6.2 Message format (U-25)

**Use a small ICU MessageFormat subset, in-house:**

- `{name}` substitution, as today;
- `{count, plural, one {…} other {…}}`, using `Intl.PluralRules`;
- `{x, select, …}`, for grammatical gender in Spanish where a template must agree with an interpolated noun.

**Why not a library:** a library (FormatJS, i18next, Lingui) would add bytes, a licence entry and a second way to write strings. The subset covers every case found in today's catalogue. `Intl.PluralRules` and `Intl.ListFormat` are supported by every NFR-C1 browser.

Messages are parsed in tests (I18N-06), so a broken message never reaches the runtime.

### 6.3 Switching language

- **The Table and the Records hold no rendered text (ADR-0002),** so a switch only re-renders.
- **On-screen statements re-render** from their template ID and parameters.
- **The provenance log is append-only.** Entries already logged keep their original text and locale (I18N-20).
- **Live regions don't re-announce** content that only changed language.

### 6.4 Data model changes

The fields below extend engineering spec §4.4.

| Entity | Change |
|---|---|
| `Provenance` (template kind) | Add `locale` and `catalogueVersion` |
| `Statement` | Already has `locale`; now enforced |
| `SignOff` | Add `locale`. Scope can be a single catalogue entry or a lesson's text |
| `ProgressExport.settings` | Add `locale`. `schemaVersion` bumps, with a migration that defaults to device matching |
| `Lesson`, `Exercise`, `Step`, `Prompt` | Unchanged. They hold `textRef`s, not text |

## 7. Seed terminology (drafts for the teachers)

These are Claude's starting points, so the teachers' glossary work begins from a list rather than a blank page. **Nothing here is approved.** † marks terms known to vary by region or club.

| English | zh-Hans | zh-Hant (Taiwan) | ja | es |
|---|---|---|---|---|
| Bridge | 桥牌 | 橋牌 | ブリッジ | bridge |
| ♠ ♥ ♦ ♣ | 黑桃 红心 方块 梅花 | 黑桃 紅心 方塊 梅花 | スペード ハート ダイヤ クラブ | picas, corazones, diamantes, tréboles |
| North, East, South, West | 北 东 南 西 | 北 東 南 西 | 北 東 南 西, or N E S W † | Norte, Este, Sur, Oeste (N E S O) |
| Declarer | 庄家 | 莊家 | ディクレアラー | declarante † |
| Dummy | 明手 | 夢家 | ダミー | muerto |
| Trick | 墩 / 赢墩 | 墩 † | トリック | baza |
| Trump | 将牌 | 王牌 | 切り札 (avoid トランプ alone) | triunfo |
| No-trumps | 无将 (NT) | 無王 | ノートランプ (NT) | sin triunfo † (ST or SA) |
| Contract | 定约 | 合約 | コントラクト | contrato |
| Pass / Double / Redouble | 不叫 / 加倍 / 再加倍 | 不叫 / 賭倍 / 再賭倍 † | パス / ダブル / リダブル | paso / doblo / redoblo † (contra / recontra) |
| Follow suit | 跟出同花色 | 跟牌 † | フォロー | asistir † (servir) |
| Opening lead | 首攻 | 首引 | オープニングリード | salida |
| HCP ("points" in UI copy) | 大牌点 | 大牌點 | ハイカードポイント (HCP) | puntos de honor † |
| Down 1 | 宕一 | 倒一 † | 1ダウン | una multa † (una abajo) |
| A K Q J (card faces) | A K Q J | A K Q J | A K Q J | A R D J/V † (U-23) |

**Teenage-register words are transcreated, not translated.** They are written fresh in each language, and each needs its own teacher sign-off: "X-ray view", "No peeking", "Good call, bad luck", "Worked this time".

## 8. UX changes

These extend UX §9 and §11.

- **Settings → Language** is a list of endonyms in their own script (§4), with the current one ticked.
  - It has no flags, because languages are not countries.
  - It shows only shipped locales; preview locales also appear in non-production builds.
- **First launch:** no language prompt. The device language decides, and Settings changes it (I18N-01).
- **Copy rules (UX §11) apply in spirit in every locale:**
  - second person, present tense;
  - no "wrong", "bad" or "fail";
  - no pressure;
  - the same honesty about uncertainty.
- **Each Locale Glossary also records the register the teacher picks:**
  - `ja`: polite です/ます or casual (U-22);
  - `es`: *tú*, or *vos* if the region uses it;
  - `zh-Hans` and `zh-Hant`: 你.
- **The design bundle is English-only.** Where a translated screen doesn't fit, the layout changes: the copy is not cut to fit. A cut is a teacher's decision, recorded in the glossary.

## 9. Testing

The engineering spec's seams apply (§5.2), with no mocked rules core.

| Seam | What runs per locale |
|---|---|
| Unit (`node`) | Formatter, matching, placeholder parity, plural coverage, glossary lint, completeness for shipped locales, guard (I18N-22) |
| Composition | Hints, review, result and lesson player render in each locale. Provenance records the locale. Integrity templates keep their hindsight label |
| Browser and end-to-end | Device-language landing, switch mid-trick, axe, screenshots: `en` (all existing projects), `es-390`, `ja-390`, `en-XA-320` |
| Determinism | F1, F5 and the determinism suites give identical Records in every locale (I18N-15.2) |

**Test fixtures:**

- Tests that assert English copy keep running under `en`.
- New locale tests assert keys and structure, not translated wording, because the wording is a draft until signed off.

## 10. Delivery plan

Each step is its own ticket (one PR each, under about 1,000 lines). Translation PRs are mostly catalogue lines, so they say why when they run larger.

| Step | Deliverable | Depends on | Owner of the work |
|---|---|---|---|
| L0a | `en.ts` split, entry `scope`, formatter with plural and select, `-one` keys merged, concatenation removed (I18N-05 to I18N-08) | Gate (U-08 framework) | Engineering |
| L0b | Locale state, `lang`, matching, Settings row, lazy chunks, provenance locale (I18N-01 to I18N-04, I18N-20, I18N-21) | L0a | Engineering |
| L0c | Guard extension, pseudo-locale, CJK font stacks, locale Playwright projects (I18N-16, I18N-17, I18N-22, I18N-23) | L0b | Engineering |
| L1 | Locale Glossary per language, with avoid terms and register (I18N-09, I18N-18) | U-20 to U-23, a teacher per language | Teachers |
| L2 | `zh-Hans` catalogue and lesson text, signed off; locale shipped | L0, L1 for `zh-Hans` | Translator + teacher |
| L3 | `zh-Hant`, `ja`, `es`: each as L2, independently | L0, its own L1 | Translator + teacher |
| L4 | Sign-off records per locale in the pipeline (I18N-11 to I18N-14) | Pipeline sign-off (M) | Engineering |

**Ordering:**

- Nothing is built in phase V.
- L0 waits for the gate, so it lands on the MVP framework.
- L0 and L1 can run in parallel.

**What it costs, roughly:**

- **The engineering steps are small.**
- **The teacher work is large:**
  - about 290 learner-facing entries today per locale, growing with every lesson;
  - four locales, so four sets of teacher review (RK-12, RK-13).

## 11. Decisions needed

| ID | Decision | Recommendation | Approver |
|---|---|---|---|
| U-19 | **Update D4: which locales launch with the MVP** | Build L0 for the MVP. Ship `en` and `zh-Hans` at MVP (`zh-Hans` is already the D4 candidate). Ship `zh-Hant`, `ja` and `es` each when complete and signed off. Holding the MVP for all five ties its date to four teachers' availability | Owner |
| U-20 | Which Spanish: Spain (`es-ES`) or Latin American (`es-419`) | One Spanish catalogue, written for the region of the first Spanish-speaking bridge teacher recruited, and served to every `es-*`. Add a second only on learner evidence | Owner + teachers |
| U-21 | Which Traditional Chinese: Taiwan or Hong Kong | Taiwan terminology, served to `zh-HK` and `zh-MO` too. Note any Hong Kong differences in the glossary | Owner + teachers |
| U-22 | Japanese register for teenagers | です/ます, friendly rather than formal. The teacher decides | Teachers |
| U-23 | Card-face letters and strain abbreviations per locale (for example Spanish R/D/V, ST or SA) | Keep A K Q J faces in the CJK locales. Spanish follows the teacher's region | Teachers |
| U-24 | **May an AI draft translations?** (This relates to D7 and D10) | Yes, as drafts only. Each entry records `source: ai-draft`, and a bridge teacher in that language reviews and signs off every entry. Nothing AI-drafted ships unsigned | Owner |
| U-25 | Message format: an in-house ICU subset or a library | In-house subset (§6.2) | Engineering lead |
| U-26 | CJK fonts: system stacks or self-hosted Noto subsets | System stacks. Self-hosting would add megabytes per script against NFR-P1. Revisit only if screenshots show unacceptable fallbacks on a reference phone | Engineering lead + owner |
| U-27 | Rules reference text (for example the EBU MiniBridge laws summary in `result.rules`) | Translate our own paraphrase, which needs no rights record. Quoting an official translation by a national federation needs a Rights Record (LR-5) | Owner |

**Proposed ADR-0006: locales never change correctness.**

- A locale changes words only. It never changes legality, scores, verdicts, expected answers or what counts as correct.
- A translation is signed off per locale and doesn't create a new Content ID.
- This mirrors ADR-0004, and I18N-12 and I18N-15 enforce it.

## 12. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | No bridge teacher available for a language | High | High | Locales ship independently (U-19). Recruit teachers before L1. Count review time in the MVP estimate (RK-13) |
| R-2 | **A translation upgrades certainty** ("probably" becomes "is") or drops the hindsight label | Medium | High (P0/P1 in review) | I18N-14 integrity tags, checklist, back-translation, composition test |
| R-3 | Regional term mismatch (無王 vs 无将; *doblo* vs *contra*) alienates learners | Medium | Medium | Separate glossaries, no script conversion, region recorded per locale (U-20, U-21) |
| R-4 | Spanish text overflows phone layouts | High | Medium | Pseudo-locale and `es-390` screenshots from L0c, before translation |
| R-5 | Hard-coded CJK slips past the guard | Medium | Medium | I18N-22 |
| R-6 | Learners in China and Japan expect a different bidding system | Medium | Medium | Out of scope (D1). Lesson copy names the system once; collect evidence in the pilot |
| R-7 | Bundle growth slows first load | Low | Medium | Lazy chunks per locale (I18N-21) |

## 13. Proposed edits to other documents (after approval)

- **PRD §18 D4:** the decision from U-19. **PRD §10.4:** the five locales and the "ship when complete and signed off" rule.
- **Engineering spec:**
  - §4.4: the §6.4 field changes;
  - §4.9: link to this document;
  - US-01.9: generalised by I18N-05;
  - §7.3: U-19 to U-27 once accepted.
- **UX spec:**
  - §9: the Language row's behaviour (§8);
  - §11: per-locale length and register.
- **GLOSSARY §10:** *Locale* (a language and region the product is offered in); *Shipped locale* (one that is complete and signed off).
- **`docs/development.md`:** a "Locales" section once L0 lands, covering how to add a key, run the pseudo-locale and check parity.
