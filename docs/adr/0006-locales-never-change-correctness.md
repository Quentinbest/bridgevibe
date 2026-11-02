# ADR-0006: Locales never change what counts as correct

- **Status:** Accepted (Delegated to Claude by the owner, 2026-11-02)
- **Date:** 2026-11-02
- **Related:** ADR-0001, ADR-0002, ADR-0004; i18n spec I18N-12, I18N-15, I18N-20, §11; PRD §18 D4; engineering spec §4.2; CI-8; INV-1

## Context

D4 ships BridgeVibe in English and Simplified Chinese, with Traditional Chinese, Japanese and Spanish to follow (U-19). ADR-0004 settles what a new Content Version may change, but not what a translation may change. Without a rule, a locale could drift into deciding things: a translated lesson with a different expected answer, a sign-off that forks the Content ID per language, or locale-specific branches in the Table or the robots. Then an Attempt in one language could mean something different from the same Attempt in another, and the F1 and determinism suites would have to be run per locale to mean anything.

## Decision

- **A locale changes words only.** It never changes legality, turns, tricks, scores, verdicts, expected answers, the Deal, the Script, or what counts as correct.
- **A translation keeps the Content ID and Content Version.** Each locale's text is signed off on its own, keyed by Content ID, version and locale (CI-8). A translation never needs a new Content ID; a change that would need one is a correctness change under ADR-0004, made in every locale at once.
- **The locale never reaches `table`, `information`, `analysis` or `robots`.** Only the explanation module and the app know it (engineering spec §4.2). Records hold no rendered text (ADR-0002), so a locale switch only re-renders.
- **Logged statements say which locale they were rendered in** (I18N-20), so a statement can be traced to the exact text the learner saw.

## Consequences

- Progress history and Records mean the same in every locale, and need no migration when a locale is added.
- The determinism suites give identical Records under every locale (I18N-15.2), and a dependency test keeps the locale out of the deciding modules (I18N-15.1).
- Per-locale validity checks are limited to what a locale can change: catalogue completeness and placeholders, plus the teacher's sign-off checklist. Checking that a translation's prose names the same cards as the English needs prose parsing, which US-15.1–2 rules out; the implementation plan's §7, deviation 7, proposes that wording for I18N-12.1.
- Each locale needs its own teacher sign-off before it ships, which is the slowest step of each launch (spec R-1).
