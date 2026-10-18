# ADR-0003: The learner plays declarer whenever their side declares

- **Status:** Accepted (owner, 2026-10-18)
- **Date:** 2026-10-18
- **Related:** PRD FR-S2, §13.4, FR-RV2; GLOSSARY *Controller*, *Learner Side*, INV-14; open question Q1

## Context

The learner always sits South. Under the rules of bridge, North becomes declarer about half the time the North–South side wins the contract: in the auction, by naming the strain first; in MiniBridge, by holding more points. South is then dummy and makes no decision for 13 tricks. For a beginner in short phone sessions, that is the worst possible use of a deal. The PRD offered only "declarer and defender" roles and never handled this case.

The options were:
- let the learner watch as dummy (faithful to the real game, but passive);
- choose or rotate deals so that partner never declares (works only before the auction, skews practice, and impossible to guarantee in full bridge); or
- give the learner control of the declaring side.

## Decision

When the Learner Side declares, the learner is the **Controller of Declarer, whichever Seat that is**, and so also of Dummy's cards. In Setup and in defence, the learner controls only South.

## Consequences

- Every deal the learner's side wins gives the learner a full declarer play, which is the main skill in the early curriculum.
- No information boundary is crossed. Declarer's Seat View already contains Dummy's Hand once exposed, and the learner has no decision before the opening lead, so seeing North's hand early gives no advantage.
- "The learner's seat" is no longer fixed during a Playthrough. Specifications must say **Learner Side** or **Controller**, not "South", when they mean "the learner".
- The UI must make it clear which hand is being played from (rotating the display so Declarer is at the bottom is one option; that choice belongs to design).
- Trick Cost and Decision Assessment cover both declaring Hands' plays.
- Reversing this later would change what a Decision is, the review content and all teacher-labelled fixtures, so it is recorded here.
- It departs from table practice. A lesson that teaches dummy's role at a real table does so explicitly with an Exercise.
