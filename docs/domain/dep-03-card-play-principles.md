# DEP-03: Robot card-play principles

> **Status: approved by the owner on 2026-10-24 as DEP-03, including the five rules marked Proposal.** Drafted by Claude from the sources below. It is **not** a teacher sign-off: US-11.3 (both teachers review robot play on the F7 sample) still applies, and the questions in §9 stay open for the teaching advisor without blocking work. It is the list #13 builds the robot policy against (US-11.2); each rule ID becomes the rule recorded in robot provenance.

Robots sit East and West and may defend or declare. Each rule decides only from the robot's own **Seat View** (ADR-0001): its own Hand, Dummy once exposed, the Announcements and the cards already played. Rules are tried in the order listed for the robot's position in the trick; the first rule that applies picks the card, and any remaining choice between equal cards uses the fixed tie-break (spec §4.6.7: lowest card of the class, then suit order).

**Sources, read on 2026-10-24.** Rules marked **Proposal** have no source and need the advisor's decision.

- **NF1–NF6:** No Fear Bridge, *MiniBridge Part 2*, lesson *n* at `nofearbridge.co.uk/minibridge/app_courses.php?C=619&L=n`: 1–3 plan the play in no-trumps, 4 suit contracts, 5 opening leads, 6 defenders.
- **KW:** [kwbridge.com/defense.htm](https://kwbridge.com/defense.htm)
- **LC:** Larry Cohen, ["Defense: 2nd hand play"](https://www.larryco.com/bridge-articles/defense-2nd-hand-play)

## 1. Opening lead (defender on Declarer's left)

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `lead-sequence` | With a sequence of three cards headed by an honour (for example KQJ, QJ10), lead the top card. | A two-card honour sequence (KQ73) also leads the top card. | NF5 |
| `lead-long-suit` | Otherwise, lead from the longest suit: the 4th highest if the suit holds an honour, the 2nd highest if it has none. | With three cards, lead the lowest ("4th highest or lowest from three"). | NF5 |
| `lead-not-ace-without-king` | Against a suit Contract, never lead from a suit holding the ace without the king. | Fine against no-trumps. | NF5 |
| `lead-short-suit` | Against a suit Contract, with a weak hand, a singleton may be led, hoping partner wins and gives a ruff; from a small doubleton, lead the higher card. | Optional ("can"). The weak-hand test uses the robot's own HCP. | NF5 |

## 2. Second hand (playing second to a trick)

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `second-hand-cover-honour` | When an honour is led, cover with a higher honour if covering can promote a card for our side. | Don't cover the first of touching honours from Dummy (QJ9 opposite K65: cover the second). Don't cover a jack when covering promotes nothing. | NF6 ("often"), KW ("rule"), LC |
| `second-hand-split-honours` | Holding touching honours (KQJx, QJ10x), play the lowest of them. | — | KW |
| `second-hand-low` | Otherwise, play low. | LC: taking an ace second is wrong "90% of the time". KW: take it if it will probably be ruffed later. | NF6, KW, LC |

## 3. Third hand (playing third to a trick)

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `third-hand-win-cheaply` | If partner's card is already winning, play low. | **Proposal**: implied by "the lowest card that will do the job". | NF6 |
| `third-hand-high` | Otherwise, play high to win the trick or force out a higher card, using the **lowest card that does the job**, and the lowest of touching cards. | When playing after Dummy, play only as high as needed to beat Dummy's card (KJx over Dummy's Qxx when it plays low: play the jack). | NF6, KW |

## 4. Fourth hand

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `fourth-hand-win-cheaply` | Win the trick with the lowest card that beats the winning card, unless partner is already winning, in which case play low. | **Proposal**: the sources don't state a fourth-hand rule. | — |

## 5. Unable to follow suit

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `ruff-when-opponent-winning` | In a suit Contract, ruff when an opponent is winning the trick; overruff as cheaply as possible. | **Proposal.** As declarer, NF4 says "ruff as high as we can afford" to avoid an overruff. | NF4 (declarer only) |
| `discard-low` | Otherwise, discard the lowest card from the longest suit that holds no honour. | **Proposal.** No signals: a robot partner wouldn't read them, and KW's signals are beyond the beginner course. | — |

## 6. Defender leading later in the hand

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `return-partners-suit` | Lead back the suit partner led first. | Especially against no-trumps. | NF6, KW |
| `lead-through-strength` | Otherwise, lead through strength and up to weakness: lead a suit where Dummy, on our left, is weak. | Never lead a suit in which both Declarer and Dummy are void (ruff and discard). | KW |

## 7. Robot as declarer (East or West declaring)

| Rule ID | Principle | Exceptions and cautions | Source |
| --- | --- | --- | --- |
| `declarer-draw-trumps` | In a suit Contract, draw trumps first. | Don't draw a last outstanding trump that is a winner. Delay drawing trumps while ruffs are still needed in the hand with fewer trumps. | NF4 |
| `declarer-ruff-in-short-hand` | Ruff losers in the hand with the shorter trumps (usually Dummy), ruffing as high as can be afforded. | — | NF4 |
| `declarer-establish-long-suit` | Knock out the defenders' high cards early in the longest combined suit, while the lead can still be regained. | Lose the lead early, not late. | NF2 |
| `declarer-high-from-short-side` | When cashing winners in a suit, play the high cards from the shorter hand first, keeping an entry to the longer hand. | Overtake a winner when needed to avoid being cut off. | NF1 |
| `declarer-finesse` | Missing the king, lead low **towards** the queen; missing the ace, lead low towards the king. Lead a high card only if happy for it to be covered. | A finesse is a chance, not a certainty. | NF3 |
| `declarer-cash-winners` | When no rule above applies, cash a top winner; otherwise lead the lowest card of the longest suit. | **Proposal**: a fallback. | — |

## 8. What this draft leaves out

- **Signals** (attitude and count): only KW teaches them, and neither robot reads its partner.
- **Planning across the whole hand** (counting winners, "what could go wrong"): NF1–NF3 teach it to learners, but #13 is a principle policy, not a planner. Out of scope (#13: no sampled or solver play).

## 9. Questions for the teaching advisor

1. **Is this the list you teach?** Should anything be added, dropped or reordered, especially the lead rules (§1) and the second-hand exceptions (§2)?
2. **Proposals.** Agree the five rules marked **Proposal**: `third-hand-win-cheaply`, `fourth-hand-win-cheaply`, `ruff-when-opponent-winning`, `discard-low` and `declarer-cash-winners`.
3. **Cover an honour.** NF6 says "often", KW says "rule". Is the LC refinement (cover the second honour, not the first) right for beginners, or should robots always cover?
