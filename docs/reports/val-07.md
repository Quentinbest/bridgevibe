# VAL-07: key moments (#26)

Labels from AI annotators; teacher review pending, #100. Disagreements use AI adjudication (D10).

- 30 F4 decision points; 151 labelled candidate classes.
- Excluded unresolved points: none.
- Acceptable candidates assessed as mistakes: 0.
- Correct-play-loses: 27 candidates across 10 distinct points.
- Every ALL_HANDS output carries the hindsight label.
- Real Table replay, principlesPolicy robots, first-legal learner continuation, bridge-dds 1.4.0 / DDS 2.9.
- Runtime: 25.38 seconds.

Regenerate: F4_REPORT=1 npx vitest run --project node test/f4.test.ts
