# ADR-0001: The Seat View is the only input for robots and in-play coaching

- **Status:** Proposed
- **Date:** 2026-10-18
- **Related:** PRD CI-1, CI-9, FR-BOT1, FR-H2; GLOSSARY *Seat View*, *Learner View*, INV-4

## Context

The product's main promise is that robots don't cheat and in-play advice never uses cards the learner couldn't see. The PRD states this as a principle and tests it after the fact (the hidden-card permutation test). A principle enforced only by tests leaks easily: any component that is handed the whole Deal "for convenience" can use it.

There are also two different notions of "what is visible":
- what a Seat may legitimately know under the rules; and
- what the screen shows the learner, which in a lesson can include exposed hands, and in review includes all four.

Mixing them would let a lesson exposure, or a retry after review, silently feed hidden cards into a robot or a "fair" judgement.

## Decision

1. The Table is the only producer of a **Seat View**: one Seat's remaining Hand plus Public Information, including Public Constraints.
2. Robots, Hints and the Decision Quality half of a Decision Assessment receive **only** a Seat View (plus the Convention Profile and a Seed). They never receive a Deal.
3. The **Learner View** is a separate concept used only for display. Exposures and Review change it; they never change a Seat View.
4. The real Layout is available only to ALL_HANDS analysis of a completed Playthrough (Review, Trick Cost, Outcome) and to the offline content pipeline.

## Consequences

- The permutation test becomes a check on a structural property, not the only line of defence.
- Every new Public Constraint (for example, auction inferences in full bridge) must be added to the Seat View explicitly; nothing is inferred from the Deal.
- Robots in a lesson with an exposure still play as if the cards were hidden; if the author needs a robot to "know" something, it goes in the Script.
- Decisions taken after the learner has seen all hands (a retry after Review) are fair in input but not a fair *test* of the learner; see open question Q6.
- Reversing this later would mean re-auditing every consumer of game state, so it is decided now.
