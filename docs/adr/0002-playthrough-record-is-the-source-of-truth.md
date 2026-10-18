# ADR-0002: The Playthrough Record, not the Seed, is the source of truth for replay

- **Status:** Proposed
- **Date:** 2026-10-18
- **Related:** PRD FR-R8, FR-BOT4, FR-RV1, FR-RV4, FR-P4; GLOSSARY *Playthrough Record*, *Seed*, INV-13

## Context

FR-R8 says "the same seed gives an identical deal and robot actions". That reads as if a played deal could be stored as a Seed and regenerated. It cannot, reliably:

- Robot actions depend on the learner's actions, not on the Seed alone.
- Robot policies, bidding engines and Convention Profiles will change version. Re-running an old Seed under a new engine gives a different game, so Review, retry and exported history would silently describe something that never happened.
- Fallback Actions (timeouts) depend on device speed, so they are not reproducible from a Seed at all.

## Decision

1. Every Playthrough keeps a **Playthrough Record**: the Deal, Game Format, Convention Profile version, the ordered accepted Actions with their Controller, and the version of each engine that produced a Robot Action or Fact.
2. Replay, Review, retry and export read the Record. They never regenerate Actions from the Seed.
3. Determinism is a property used for testing: given the same Seed, the same learner Actions, the same engine versions and no fallbacks, Robot Actions are identical.
4. A retry creates a new Playthrough whose Record starts with a copy of the earlier Record up to the chosen Position.

## Consequences

- Review explanations can always be traced to what actually happened (supports CI-5 provenance).
- Records are larger than a Seed, which matters only for local storage size and export.
- FR-R8 and FR-BOT4 should be reworded in the PRD to state the conditional form of determinism.
