# T5 auctions (AI draft)

> **Status: AI draft, awaiting both teachers.** Drafted by Claude on 2026-10-24 at the owner's request, for #4 (PRD T5, VAL-11). Not approved, and not a teacher sign-off (CI-8).

**System:** the beginner subset common to SAYC and 2/1, which PRD T5 says to use while D1 (DEP-07) is undecided. The set avoids sequences the two systems treat differently: a 2-level new suit or a 1NT response over a major opening. Vulnerability is none throughout.

**Data:** `auctions.json` holds what the harness needs: the hand, the auction so far (from the dealer) and the seat to call. Required cases (#4): a valid alternative bid (T5-28, and T5-21), a forcing auction (T5-17), and a case no rule covers (T5-29).

`drafter-expectations.json` records the drafter's expected call for each auction. **Don't show it to the graders until they have graded the engines' calls.**

| ID | Tags | Dealer | Auction so far | To call | Hand | HCP |
| --- | --- | --- | --- | --- | --- | --- |
| T5-01 | opening, 1NT | S | (opening) | S | ♠KQ4 ♥A93 ♦KJ72 ♣Q85 | 15 |
| T5-02 | opening, major | S | (opening) | S | ♠AQJ74 ♥K82 ♦93 ♣K64 | 13 |
| T5-03 | opening, minor | S | (opening) | S | ♠KJ74 ♥Q83 ♦A72 ♣K95 | 13 |
| T5-04 | opening, minor | S | (opening) | S | ♠A4 ♥K72 ♦QJ83 ♣KJ65 | 14 |
| T5-05 | opening, strong | S | (opening) | S | ♠AKQ8 ♥AKJ5 ♦AQ4 ♣K2 | 26 |
| T5-06 | opening, weak-two | S | (opening) | S | ♠KQJ952 ♥84 ♦Q73 ♣62 | 8 |
| T5-07 | opening, 2NT | S | (opening) | S | ♠AQ5 ♥KQ4 ♦AK83 ♣Q92 | 20 |
| T5-08 | opening, pass | S | (opening) | S | ♠Q842 ♥K73 ♦J95 ♣K62 | 9 |
| T5-09 | response, raise | N | 1♥ – Pass | S | ♠842 ♥KJ73 ♦Q95 ♣862 | 6 |
| T5-10 | response, limit-raise | N | 1♥ – Pass | S | ♠84 ♥KJ73 ♦AQ5 ♣9862 | 10 |
| T5-11 | response, up-the-line | N | 1♣ – Pass | S | ♠KJ74 ♥Q983 ♦95 ♣862 | 6 |
| T5-12 | response, 1NT | N | 1♦ – Pass | S | ♠Q84 ♥K73 ♦952 ♣J862 | 6 |
| T5-13 | response, stayman | N | 1NT – Pass | S | ♠KJ74 ♥Q983 ♦K5 ♣862 | 9 |
| T5-14 | response, transfer | N | 1NT – Pass | S | ♠QJ8742 ♥83 ♦952 ♣62 | 3 |
| T5-15 | response, game | N | 1NT – Pass | S | ♠K84 ♥Q73 ♦KJ5 ♣Q862 | 11 |
| T5-16 | response, new-suit | N | 1♦ – Pass | S | ♠84 ♥KJ873 ♦95 ♣Q862 | 6 |
| T5-17 | rebid, forcing | S | 1♥ – Pass – 1♠ – Pass | S | ♠84 ♥AQJ73 ♦K95 ♣Q62 | 12 |
| T5-18 | rebid, raise | S | 1♣ – Pass – 1♥ – Pass | S | ♠84 ♥KJ73 ♦A5 ♣KJ862 | 12 |
| T5-19 | rebid, 1NT | S | 1♦ – Pass – 1♠ – Pass | S | ♠Q8 ♥K73 ♦AJ52 ♣K962 | 13 |
| T5-20 | rebid, reverse | S | 1♦ – Pass – 1♠ – Pass | S | ♠4 ♥AKJ7 ♦AQ952 ♣K62 | 17 |
| T5-21 | rebid, game-try | S | 1♥ – Pass – 2♥ – Pass | S | ♠A4 ♥AKJ73 ♦KQ5 ♣962 | 17 |
| T5-22 | competitive, overcall | E | 1♦ | S | ♠KQJ84 ♥73 ♦952 ♣A62 | 10 |
| T5-23 | competitive, takeout-double | E | 1♥ | S | ♠KQ84 ♥3 ♦AJ52 ♣K962 | 13 |
| T5-24 | competitive, 1NT-overcall | E | 1♣ | S | ♠AJ4 ♥KQ3 ♦K972 ♣KJ5 | 17 |
| T5-25 | competitive, negative-double | N | 1♣ – 1♠ | S | ♠84 ♥KJ73 ♦Q952 ♣862 | 6 |
| T5-26 | competitive, pass | N | 1♥ – 2♣ | S | ♠8642 ♥3 ♦Q952 ♣K762 | 5 |
| T5-27 | competitive, advance | W | 1♣ – 1♠ – Pass | S | ♠K84 ♥Q73 ♦J952 ♣862 | 6 |
| T5-28 | valid-alternative | S | (opening) | S | ♠K4 ♥AQ973 ♦KJ5 ♣Q62 | 15 |
| T5-29 | not-covered | N | 1NT – 2♦ | S | ♠AJ874 ♥KQ953 ♦4 ♣62 | 10 |
| T5-30 | rebid, accept-invite | S | 1♠ – Pass – 3♠ – Pass | S | ♠AKJ74 ♥K82 ♦Q3 ♣K64 | 16 |

## Questions for the teachers

1. Are these the auctions you want, or would you swap some for ones you teach?
2. Confirm the beginner subset: 15–17 1NT, five-card majors, Stayman and Jacoby transfers, weak twos, strong 2♣, negative doubles. Are any of these not taught?
3. T5-29 (interference over our 1NT) is meant to have no rule. Agree?
