# ADR-0004: Content versions never change what counts as correct

- **Status:** Accepted (owner, 2026-10-18)
- **Date:** 2026-10-18
- **Related:** PRD FR-L4, FR-P1, FR-P3; GLOSSARY *Content ID*, *Content Version*, *Attempt*, INV-15; open question Q4

## Context

FR-L4 requires a stable ID and a content version so "corrections do not corrupt progress history", but it does not say what a correction may change. If a new version could change the Expected Answer, the Deal or the Script, an earlier "correct" Attempt might now be wrong, and Lesson Completion and Skill Tag history would quietly mean different things for different learners. Progress is stored locally on devices we can't migrate centrally, so this has to be settled before any Attempts exist.

## Decision

- A new **Content Version** may change wording, commentary, presentation, Hints and Skill Tags.
- Changing anything that decides correctness (an Expected Answer, the Deal or Position, the Script, or the Prompt's question) requires a **new Content ID**. The Lesson then lists the new item in place of the old one.
- Attempts always refer to a Content ID and version, and stay valid forever.

## Consequences

- Progress history never has to be reinterpreted or migrated.
- When a Lesson swaps in a replacement item, the learner has a new Prompt to answer, and Lesson Completion can drop. That is honest: they haven't answered the corrected item.
- Authors and the content pipeline need a check that rejects a version bump which changes correctness-deciding fields.
