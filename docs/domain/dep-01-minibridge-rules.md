# DEP-01: MiniBridge rules specification (AI draft)

> **Status: AI draft, awaiting the teaching advisor's review.** Drafted by Claude on 2026-10-24 at the owner's request. It is **not** the approved DEP-01 and is not a teacher sign-off (CI-8). Every rule below cites its source; the questions for the advisor are at the end.

**Main source:** English Bridge Union, *All About MiniBridge*, March 2008 edition, "The Laws of MiniBridge" (Laws 1–25) and its "Summary of MiniBridge". **Cross-checked against:** EBU, ["How to score in MiniBridge"](https://ebu.co.uk/node/122), and No Fear Bridge, [MiniBridge Part 1, lesson 2](https://www.nofearbridge.co.uk/minibridge/app_courses.php?C=612&L=2).

## 1. Setup

| # | Rule | Source | BridgeVibe today |
| --- | --- | --- | --- |
| R1 | HCP: ace 4, king 3, queen 2, jack 1. | Law 4 | Same |
| R2 | Each player announces their HCP in turn, starting with the Dealer and going clockwise. | Law 5 | Same (`miniBridge.ts`) |
| R3 | If each Side holds 20 HCP, the Deal is redealt. | Law 6; Summary 4 | Same (Redeal from the Seed, US-06.2) |
| R4 | The Side with more HCP is the Declaring Side. Declarer is the partner with more HCP; if the partners are equal, Declarer is the one who announced first. | Law 7; Summary 4 | Same (`tied` keeps the first announcer) |
| R5 | Dummy is exposed **after Declarer is known and before the Contract is chosen**, so Declarer sees both hands when choosing. | Law 8, Law 9 ("After seeing the dummy…") | Same |
| R6 | Declarer announces the Contract as a Strain (a trump suit or no-trumps) and an Objective (**part-score** or **game**), for example "Game in clubs". | Law 9 | Same (Strain + Objective, Q5) |
| R7 | The player on Declarer's left makes the opening lead. | Summary 6; No Fear Bridge L2 | Same |

## 2. Goal (trick targets)

| Objective | Strain | Goal | Source |
| --- | --- | --- | --- |
| Part-score | Any | 7 tricks | Law 10 |
| Game | No-trumps | 9 tricks | Law 10 |
| Game | Hearts or spades | 10 tricks | Law 10 |
| Game | Clubs or diamonds | 11 tricks | Law 10 |

Declarer may exceed the goal (Law 10). These are the values in `table/miniBridgeRules.ts` today, so **the placeholder matches the Laws**.

## 3. Scoring (for #17)

| # | Rule | Source |
| --- | --- | --- |
| S1 | Goal reached: the Declaring Side scores each trick beyond six ("odd tricks"), including overtricks. | Law 16 |
| S2 | Trick values: no-trumps 40 for the first odd trick, then 30 each; hearts or spades 30; clubs or diamonds 20. | Law 16 |
| S3 | Bonus when the goal is reached: part-score 50, game 300. | Law 16 |
| S4 | Goal missed: the Declaring Side scores nothing; the defenders score 50 for each trick short of the goal. | Law 17 |
| S5 | No vulnerability, no doubling and no slam bonus in the standard Laws. | Laws 9–17 (none mentioned) |
| S6 | Each Deal is scored on its own. | Law 18 |

**Worked examples** for the F6 MiniBridge cases, taken from the EBU scoring page and consistent with Laws 16–17:

| Contract | Tricks | Declaring Side | Defenders |
| --- | --- | --- | --- |
| Part-score, clubs | 8 | 2 × 20 + 50 = **90** | 0 |
| Part-score, clubs | 6 | 0 | **50** |
| Part-score, spades | 10 | 4 × 30 + 50 = **170** | 0 |
| Game, spades | 10 | 4 × 30 + 300 = **420** | 0 |
| Game, hearts | 8 | 0 | **100** |
| Part-score, no-trumps | 9 | 40 + 30 + 30 + 50 = **150** | 0 |
| Game, no-trumps | 9 | 40 + 30 + 30 + 300 = **400** | 0 |
| Game, no-trumps | 8 | 0 | **50** |
| Game, diamonds | 12 | 6 × 20 + 300 = **420** | 0 |

## 4. Optional variants (not recommended for v1)

The 2008 booklet lists these as teaching variations, not part of the Laws:

- **Slam.** A goal of 12 tricks in any Strain, with an 800 bonus. **The sources disagree:** the EBU scoring web page gives 500 for a small slam (12) and 1,000 for a grand slam (13).
- **A goal set by combined points** (for example 21–22 HCP: 7 tricks … 29–32: 11).
- **Win or loss scoring** only, without points.
- **No-trumps first**, with trumps introduced later.

**Recommendation:** none of these in v1. They would add a third Objective and a scoring choice that the Laws themselves don't require.

## 5. Questions for the teaching advisor

1. **Confirm the Laws edition.** Is the 2008 *All About MiniBridge* the convention to name, or is there a newer EBU text you teach from?
2. **Slam.** Agree to leave it out for v1? If it is wanted, which bonus: 800 (booklet) or 500/1,000 (EBU web page)?
3. **Scores for teenagers.** Should the app show points at all (S1–S4), or the booklet's "win or loss" variant, at least for early lessons?
4. **Wording.** Are "part-score" and "game" the words you want learners to see, or plainer ones (for example "safe target" and "big target")?
