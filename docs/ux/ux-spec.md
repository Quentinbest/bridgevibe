# PlayBridge: UI/UX Specification

| Field | Value |
|---|---|
| Status | **Draft v0.1, for owner and teacher review** |
| Date | 2026-10-18 |
| Derived from | `docs/PRD.md` v0.2 · `GLOSSARY.md` · `docs/adr/0001`–`0004` · `docs/domain/open-questions.md` |
| Scope | MVP (phase M), with the MiniBridge slice (phase V) marked where it differs |

This is the first UI/UX document for the project; no earlier version existed. It turns the PRD's requirements into screens, states, interaction rules and copy rules. Requirement IDs (FR, CI, NFR, INV) refer to the PRD and glossary. Where design needed a decision the PRD doesn't make, it is marked **UX decision** with its reason. Where it needs a PRD change, it is listed in §12.

**Copy in this document is draft.** Every learner-facing sentence needs teacher sign-off as a Template (CI-8) before it ships.

---

## 1. Design principles

These turn the PRD's product principles (§5) and the teen audience (§4, D9) into rules for the interface.

1. **Phone first, one thumb.** Design for a 360 × 640 px portrait screen first. Every primary action sits in the bottom third of the screen.
2. **Never lost, never judged.** The learner always knows whose turn it is, which hand they are playing from, and what to do next. Mistakes are framed as normal and fixable.
3. **Short sessions win.** A lesson takes 3–5 minutes and a practice deal about 5–8. The app can be left at any point and resumed exactly (FR-R10).
4. **Two kinds of truth, two looks.** What the learner could see (`VISIBLE`) and hindsight (`ALL_HANDS`, "X-ray view") never share a visual style (CI-1, CI-2, INV-5).
5. **The coach says "I don't know" out loud.** Abstentions are designed states, not errors (CI-4, INV-7).
6. **Progress without pressure.** No streaks that can be lost, countdowns, leaderboards, chat or ads (NFR-S, AADC). Progress shows what was learned, never what will be lost.
7. **Friendly, not childish.** Plain words, short sentences, no baby talk, no mascots that talk down.

---

## 2. Information architecture

### 2.1 Navigation

A bottom tab bar on phones; a left rail on screens 900 px wide and above.

| Tab | Contents | Requirements |
|---|---|---|
| **Learn** | Module map → Lessons → Lesson player | FR-L1–L3 |
| **Practice** | New deal, continue deal, recent deals and their reviews | §7 journeys 2, 4; FR-R10 |
| **Rules** | Rules reference, glossary, "How scoring works" | FR-E2 |
| **Me** | Progress, settings, export and import, about and privacy | FR-P1–P4, FR-S1 |

During a lesson or a deal, the tab bar is hidden and replaced by a top bar with **Exit**, which saves and leaves; the playthrough stays resumable.

### 2.2 First launch

```
Age question → (13+) Welcome (one screen) → Lesson 1.1 starts
            → (under 13) "Not yet" screen
```

- **Age question (NFR-S age gate).** "How old are you?" with a scrolling picker that has no preselected value and doesn't hint at a "right" answer. There is no account and nothing else is asked.
- **Under 13.** "PlayBridge is made for ages 13 and up. Bridge clubs and schools often run junior sessions; ask a teacher or a local club." It links to the **Rules** reference, which collects no data. This is not a dead end, and the app does not let the user change the answer straight away.
- **Welcome.** One sentence about what bridge is, plus one button: **Start learning**. No tour carousel; the first lesson *is* the tour.
- **Analytics consent** is asked later, once, from Me → Privacy, off by default. It is never asked during onboarding.

### 2.3 Home state

There is no separate home screen. The app opens on **Learn**, with a **Continue** card at the top when anything is in progress:

```
┌──────────────────────────────┐
│ Continue                     │
│ Practice deal · trick 7 of 13│
│ [ Resume ]                   │
└──────────────────────────────┘
```

When nothing is in progress, the card suggests the next lesson (FR-P5, Could), or the next unfinished lesson in module order if no suggestion is available.

---

## 3. The table

The table is the core screen. It is used by lessons, practice and the MiniBridge slice.

### 3.1 Phone layout (portrait)

```
┌────────────────────────────────────┐
│ ✕ Exit        4♠ by S · You: 7/10  │  status bar
├────────────────────────────────────┤
│        N  (dummy, face up)         │
│   ♠ K Q 7   ♥ A 5   ♦ 9 8 4   ♣ …  │  dummy in suit columns
│                                    │
│  W ▢▢▢           ┌─────┐   E ▢▢▢   │  opponents: card backs + count
│                  │ trick│          │
│                  └─────┘           │
│  ▶ Your turn: play from South      │  turn banner
├────────────────────────────────────┤
│ ♠ A J 9 4     ♥ K Q 8              │  your hand, two rows
│ ♦ A 7 2       ♣ J 6                │  on narrow screens
├────────────────────────────────────┤
│ [ Hint ]   [ Last trick ]   [ ⋯ ]  │  action bar
└────────────────────────────────────┘
```

- **Opponents** show card backs and the number of cards left. Hidden cards are never drawn face up during play, not even in a lesson, unless an Exposure step reveals them (ADR-0001: the Learner View may change; the Seat View never does).
- **Dummy** is shown in suit columns, as at a real table.
- **The learner's hand** is grouped by suit. Below 400 px width it wraps into two rows, so each card's tap target is at least 44 px wide (NFR-A). At 400 px and above it is one overlapping row with a 44 px minimum exposed edge.
- **The status bar** shows the Contract (or "Bidding…"), Declarer, and the tricks won by the learner's side against the target.

### 3.2 Which hand is at the bottom (ADR-0003)

**UX decision: when the learner's side declares, the display rotates so Declarer is at the bottom and Dummy at the top.** In defence and during the auction, South is at the bottom.

*Why:* every declarer play then has the same shape: your playing hand at the bottom, dummy face up at the top, opponents left and right. This matches how lessons show declarer play. The alternative (South always at the bottom, playing North's hand at the top) makes the learner reach across the screen and invert their sense of left and right.

The rotation is explained the first time and announced every time:

- **First time (once per learner):** an inline card, not a modal: "North won the contract, so you play North's cards as declarer. Your own hand becomes dummy. We've turned the table so the hand you play from is at the bottom." **Got it**.
- **Every time:** the seat labels animate to their new places (an instant swap under reduced motion), and the turn banner names the seat: "Play from North (declarer)".
- **Seat compass:** each hand always shows its seat letter (N, E, S, W). The learner's own seat carries a "You" tag in setup and defence, and both declaring hands carry "You play" when the learner declares.

*Test in T7b:* whether beginners lose track after rotation. The fallback design is no rotation, with a stronger turn banner.

### 3.3 Playing a card

| Rule | Detail |
|---|---|
| **Tap to raise, tap again to play** | The first tap raises the card and shows a **Play ♠J** button in the action bar; a second tap on the card, or the button, plays it. This prevents accidental plays on small screens. A **One-tap play** setting removes the confirmation |
| **Keyboard** | Arrow keys move between cards, Enter or Space raises and plays, Esc lowers (NFR-A) |
| **Playable-card highlight** | In Practice, legal cards sit slightly higher and illegal ones are dimmed (setting, on by default). **Off in modules 1–2**, because following suit is what those lessons teach (§12, P-1) |
| **Forced plays** | With **Auto-play forced plays** on (Practice only, FR-S1), the card plays itself after 600 ms with a "Only card" tag. Always off in modules 1–2 |
| **Trick completion** | The trick stays visible for 1 s (setting: animation speed), then collects towards the winner's side. **Last trick** shows the previous trick at any time |

### 3.4 When an action is rejected (FR-R1, FR-E1, INV-3)

The state never changes. The feedback is immediate and calm:

- The card returns to the hand with a small shake (none under reduced motion).
- An inline message appears above the hand, not a modal, and stays until the next action. It shows the Reason Code Template, plus **Why?**, which links to the Rule Reference:

  > You have to follow suit — you still have a ♥.  **Why?**

- **In a lesson prompt that counts rejections as wrong answers** (FR-L1), the message adds the lesson's own feedback, and the Attempt is marked accordingly. Otherwise, a rejection is rules feedback only and is never counted.
- **Screen readers** hear the same text through an assertive live region.

---

## 4. Setup screens

### 4.1 Auction (Contract Bridge, MVP)

```
┌────────────────────────────────────┐
│  W      N      E      S            │  auction grid, dealer first
│  —     1♦     Pass   ?             │  tap any call → its meaning
├────────────────────────────────────┤
│ Your hand (always visible)         │
├────────────────────────────────────┤
│ [1][2][3][4][5][6][7]              │  level row
│ [♣][♦][♥][♠][NT]                   │  strain row (after a level is chosen)
│ [Pass]   [Double]   [Redouble]     │
│                 [ Bid 1♥ ]          │  confirm
└────────────────────────────────────┘
```

- **Bidding box.** Choose a level, then a strain, then confirm. Bids that aren't higher than the last bid are greyed out. Double and Redouble are enabled only when legal (FR-R3). Tapping a greyed control shows its Reason Code text, so the rules stay discoverable.
- **Call meaning (FR-E4).** Tapping any call in the auction grid, or long-pressing a call in the bidding box, opens a bottom sheet:

  > **1♦ by North**
  > 12–21 points, usually 4 or more diamonds. *(Rule: opening-1D · Profile v1)*
  > or, when the profile has no rule: *The coach doesn't cover this call yet.* (Abstention: not covered)

  The rule reference in italics is shown only when the debug panel is enabled, not in normal use.
- **Robot calls** appear with a short delay (300–600 ms) so the learner can follow the auction. A **fallback call** (FR-B3) carries a small "auto" tag; its meaning sheet says it was not chosen by a bidding rule.
- **Leaving coverage (FR-B5, Q9).** A banner appears above the bidding box and stays for the rest of the auction:

  > **Off the map.** The coach can't grade calls from here.
  > [ Keep bidding (not graded) ]  [ Finish the auction for me ]

- **Pass-out (Q11).** If all four players pass, a result card appears: "Everyone passed — no contract, so the score is 0. That happens when no one has enough to open." **Next deal**.

### 4.2 MiniBridge setup (slice, phase V; MVP only if D5)

The setup follows the EBU steps in PRD §13.4, one screen state per step, each advanced automatically or with a single tap:

1. **Announce points.** Each seat's points appear in turn from the dealer, with a 0.5 s stagger. In a lesson, the learner may be asked to count first ("How many points do you have?" with a number pad). That is a Prompt; the announcement shown afterwards is always the true total (INV-10).
2. **Redeal (20–20).** "It's 20–20 — nobody gets to declare. Dealing again." This shows automatically for 1.5 s.
3. **Who declares.** The two partnership totals are shown, and the declarer is highlighted with a one-line reason ("East–West have 23. East has more points, so East declares").
4. **Dummy goes face up.** Dummy's hand flips over, before the contract is chosen.
5. **Contract choice** (when the learner declares). Choose a strain (four suits and NT) and an objective (**Part-score** or **Game**), each showing its trick target, then **Choose**. The trick targets come from the MiniBridge rules specification (Q5).
6. **Opening lead.** The table state from §3 takes over.

---

## 5. Coach

### 5.1 Visual language for information modes (CI-1, CI-2, INV-5, INV-6)

| Mode | Where it appears | Look | Label |
|---|---|---|---|
| `VISIBLE` | Hints, call meanings, rule feedback | Standard surface; coach icon | None needed |
| `ALL_HANDS` | Review only | Tinted "X-ray" surface (a distinct hue that passes AA in light and dark themes) **plus** an X-ray icon and text, never colour alone | **X-ray view: all cards visible** (teacher-approved wording, D9) |

**Hard rule:** nothing with the X-ray look is ever shown while the learner still has a decision to make in that playthrough (INV-6). This includes animations that might reveal hidden cards when a deal ends.

### 5.2 Hints (FR-H1–H5)

- **Entry.** The **Hint** button in the action bar. It is hidden when hints are switched off (FR-S1). In lessons, the lesson decides whether hints are available.
- **Hint sheet.** A bottom sheet covering at most 40% of the screen, so the table stays visible. One sentence of advice, one sentence of why, then **Got it**.

| Tier | Example copy (draft) |
|---|---|
| (a) Lesson hint | "Remember: second hand low. Keep your king for later." |
| (b) Principle | "When you're second to play, playing low is usually right. Your partner still gets a turn." |
| (c) Sampled estimate | "From what you can see, ♠Q looks best: it usually makes one more trick than ♠3. It's an estimate — the hidden cards could be anywhere." |

- **No percentages** that read as "the chance you're right" (CI-6, INV-11). Tier (c) uses words such as "usually" and "often", with an estimate disclaimer.
- **No cards marked on the table** by a hint, unless the hint is authored and points at the learner's own cards. The learner still makes the play.
- **Abstention states.** The same sheet is used, with a neutral icon:

| Reason | Copy (draft) |
|---|---|
| not covered | "This one's outside what the coach knows so far. Trust your reading of the cards." |
| uncertain | "Too close to call from what you can see. Both plays are reasonable." |
| unavailable | "The coach is offline right now. You can keep playing." |

### 5.3 Result and score (FR-E3)

After the last trick, a result card slides up:

```
┌────────────────────────────────────┐
│ 4♠ by South — made, +1             │
│ Score: +450 for North–South        │
│ ▸ How the score was worked out     │  expandable, in words
│ [ Review this deal ]  [ Next deal ]│
└────────────────────────────────────┘
```

- **Copy rule:** "score" for the Score; "points" only for HCP (glossary, *Score*).
- Review is offered but not forced. **Next deal** is never pre-selected and never counts down.

### 5.4 Review (FR-RV1–RV5)

Review opens in the **X-ray look** from the top of the screen, so the change of mode is obvious.

```
┌────────────────────────────────────┐
│ ◉ X-ray view: all cards visible    │  persistent label
├────────────────────────────────────┤
│ Key moments (up to 3)              │
│ ┌────────────────────────────────┐ │
│ │ Trick 3 · you played ♦4        │ │
│ │ ⚖ Good call, bad luck          │ │
│ │ The finesse was the right try; │ │
│ │ East had the king. Cost: 1 trick│ │
│ │ [ Show me ]   [ Try from here ]│ │
│ └────────────────────────────────┘ │
├────────────────────────────────────┤
│ Replay:  ⏮  ◀  Trick 3 of 13  ▶  ⏭  │
│ (auction step, then tricks)        │
└────────────────────────────────────┘
```

- **Key moments come first**, because that's where the learning is. The full replay sits below and is optional.
- **Replay** steps through the auction and then the play, reading the Playthrough Record (INV-13). **Show me** jumps the replay to that key moment.
- **Trick cost.** In replay, each of the learner's card plays shows a small badge: **0** in neutral, **−1** and so on in the X-ray style. Forced plays show no badge. When the learner declared, plays from both declaring hands are covered (FR-RV2).
- **Decision assessment badges (CI-3).** Each has an icon, a text label and a colour, never colour alone:

| Assessment | Badge (draft) | Tone rule |
|---|---|---|
| sound | ✓ **Solid** | Brief praise |
| good decision, unlucky layout | ⚖ **Good call, bad luck** | Reassure; explain what the cards were |
| lucky | ↯ **Worked this time** | Never praised; name the safer play |
| mistake | ↻ **Better option** | Say what to do instead and why; no red X, no "wrong" |

  For calls, only quality is assessed, so the badges are **Solid** or **Better option**, with the expected call and any accepted alternatives.
- **Try from here (retry, FR-RV4, INV-16).** This starts a new playthrough at that position, with a persistent strip: "Practice retry — you've seen all the cards, so this one doesn't count toward progress." The X-ray look is switched off again for play.
- **Waiting for analysis.** While the solver works (NFR-P3), key-moment cards show a skeleton and "Working out the X-ray view…". If it fails, the cards say "X-ray view isn't available right now", which is the *unavailable* abstention. The replay still works, because it reads the record.

---

## 6. Lessons (FR-L1–L6)

### 6.1 Module map

- A vertical list of the ten modules (FR-L2). Each module expands to its lessons. Each lesson shows its title, about how many minutes it takes, and a completion tick.
- **Not locked.** Every module can be opened. The next recommended lesson is highlighted, and a gentle note appears on modules that build on unfinished ones ("Uses ideas from Module 5"). Teenagers resent locks, and the progress model doesn't need them.
- **No "mastery" wording** anywhere (FR-P3, glossary *Mastery*).

### 6.2 Lesson player

The lesson player uses the table component from §3 with a commentary panel.

```
┌────────────────────────────────────┐
│ ✕   Lesson 2.1 · Following suit  ●●○○○ │  steps as dots, not a timer
├────────────────────────────────────┤
│ [table, with exposures as authored]│
├────────────────────────────────────┤
│ West led the ♥5. Which card must   │  commentary / prompt
│ you play?                          │
│                       [ Next ▸ ]   │  only for commentary steps
└────────────────────────────────────┘
```

- **Steps (glossary: Step).** A commentary step shows **Next**. A prompt waits for an answer. An exposure flips the named hidden cards face up, with a "Shown for this lesson" tag on those cards. A scripted action plays out with the normal robot delay.
- **Answer feedback:**
  - **correct:** a brief tick and one line of why, then the lesson continues;
  - **wrong:** "Not quite — [one-line reason]. Try again." On a second wrong answer, **Show me** reveals the answer (the Attempt becomes *failed*). A right answer after a wrong one makes it *corrected* (FR-P1).
  - After the answer, the lesson continues on the script whatever the learner chose (FR-L1).
- **Several right answers** (accepted alternatives, touching honours) are all accepted; the feedback names the others: "♠Q works too — they're the same here."
- **Lesson end:** what was learned in one sentence, then **Next lesson** and **Back to map**. No score and no stars.

---

## 7. Practice

- **New deal** starts straight away with the learner as South. Dealer and vulnerability are shown in the status bar ("Dealer W · You're not vulnerable") with a **?** that explains them (FR-R5).
- **Role mix (FR-S2).** Practice alternates between deals where the learner's side is likely to declare and deals where it is likely to defend. The learner doesn't choose; the setting only exists for testing.
- **Recent deals.** The last 20 completed playthroughs, each with its contract, result and a **Review** link. They are stored locally only.
- **Resume (FR-R10).** Closing the app at any point keeps the playthrough. Reopening shows the Continue card (§2.3). A deal abandoned for more than 7 days is moved to Recent deals as *abandoned* (UX decision: keeps Continue relevant; nothing is deleted).

---

## 8. Progress (Me tab)

| Shown | Not shown |
|---|---|
| Lessons completed per module; skills practised (skill tags, in plain words); deals played this week; a "Things you've learned" list | Streaks, daily goals, levels, XP, leaderboards, "you'll lose…" messages, mastery percentages |

- **Export and import (FR-P4).** **Save my progress to a file** and **Load progress from a file**, with a plain explanation that progress lives on this device only.
- **Privacy.** A short, readable summary: no account, nothing leaves the device unless analytics are switched on, and what analytics would include.

---

## 9. Settings (FR-S1)

| Setting | Default | Notes |
|---|---|---|
| Hints | On | Hides the Hint button when off |
| Auto-play forced plays | Off | Practice only; locked off in modules 1–2 |
| Highlight playable cards | On | Practice only; locked off in modules 1–2 (§12, P-1) |
| One-tap play | Off | §3.3 |
| Four-colour suits | Off | ♠ black, ♥ red, ♦ orange, ♣ green, always with symbols |
| Animation speed | Normal | Slow / Normal / Fast |
| Reduced motion | Follows the system setting | Can be forced on |
| Theme | Follows the system setting | Light / Dark |
| Language | Device language if supported (D4) | |
| Developer: provenance panel | Hidden | Internal builds only (CI-5); shows the provenance of each statement |

---

## 10. Accessibility (NFR-A, WCAG 2.2 AA)

- **Cards** are buttons with full names: "Jack of spades, playable" or "…, can't play: you must follow hearts". Suit symbols always come with text for assistive technology.
- **Live announcements** (polite): whose turn it is, each card played ("East plays the 9 of hearts"), and trick winners. Rejections and abstentions use an assertive region.
- **Focus.** After each robot action, focus returns to the learner's hand. Bottom sheets trap focus and return it when closed.
- **Colour** is never the only signal: badges, modes and suits all carry icons or text. All text and the X-ray tint meet AA contrast in both themes.
- **Targets:** 44 × 44 px minimum, including bidding-box buttons (seven level buttons fit in 328 px at 44 px with 3 px gaps).
- **Motion:** every animation has an instant alternative, and nothing flashes.
- **Text size:** layouts hold at 200% text zoom. The two-row hand layout is used whenever cards would fall below 44 px.

---

## 11. Copy rules (teen register)

- Short sentences of at most about 15 words, in the second person, in the present tense.
- Glossary terms, translated through the Locale Glossary. "Points" means HCP, "score" means Score, "deal" means Playthrough in copy, "call" is the umbrella for Pass, Bid, Double and Redouble.
- Mistakes: say what to do instead, then why. Never "wrong", "bad" or "fail" in learner-facing copy. ("Failed" is an internal Attempt outcome only.)
- Never claim certainty the coach doesn't have; use the abstention copy in §5.2.
- Never pressure: no "Don't stop now!", no exclamation-mark streak copy.
- Every sentence is a signed-off Template before release (CI-8). The examples in this document are drafts for that review.

---

## 12. Proposed PRD changes found while designing

| ID | Proposal | Reason |
|---|---|---|
| P-1 | Add **Highlight playable cards** to FR-S1 (Practice only; off in modules 1–2) | Dimming illegal cards speeds up practice, but it would give away the answer in the following-suit lessons |
| P-2 | Record the table rotation (§3.2) as **ADR-0005**, or as an amendment to ADR-0003 | ADR-0003 leaves the display to design; the choice affects lessons, review and testing, so it should be explicit |
| P-3 | Add **tap-to-raise, confirm-to-play** as the default card interaction to NFR-A or FR-R | Prevents accidental plays on small screens; it also matters for fairness, since an accidental play becomes a recorded Decision |
| P-4 | Add a UX question set to T7b (learner observation) | §13: rotation, hint wording, assessment badges, retry strip |
| P-5 | Define the abandoned-playthrough timeout (§7: 7 days) in FR-R10 | The glossary lists *abandoned* as a status, but nothing triggers it |

---

## 13. Questions to test with learners (T7b, then the MVP pilot)

1. After the table rotates, can learners say which hand they are playing from?
2. Do learners read "Good call, bad luck" as reassurance, or as the app making excuses?
3. Is "Worked this time" understood as "don't rely on this"?
4. Do learners notice that X-ray statements are hindsight? (Ask them to explain a review card in their own words.)
5. Does tap-to-raise feel slow? Does anyone switch on one-tap play?
6. Do abstention messages reduce trust in the coach, or increase it?

---

## 14. Screen inventory and traceability

| Screen or state | Phase | Requirements |
|---|---|---|
| Age question; under-13 screen | M | NFR-S |
| Learn: module map, Continue card | M | FR-L2, FR-R10, FR-P5 |
| Lesson player (steps, prompts, exposures, feedback) | V (minimal), M | FR-L1, FR-L3, FR-H3(a), FR-P1, Q3, Q12 |
| Table: play, rotation, rejection feedback | V, M | FR-R1, FR-R2, FR-E1, ADR-0003, NFR-A |
| Auction and bidding box; call meaning sheet; coverage banner; pass-out card | M | FR-R3, FR-E4, FR-B3, FR-B5, Q9, Q11 |
| MiniBridge setup sequence | V; M if D5 | FR-R4, §13.4 |
| Hint sheet and abstention states | V, M | FR-H1–H5, CI-1, CI-4, CI-6 |
| Result card and score breakdown | V, M | FR-E3 |
| Review: key moments, replay, trick cost, assessments, retry | V, M | FR-RV1–RV5, CI-2, CI-3, INV-6, INV-13, INV-16 |
| Rules reference and glossary | M | FR-E2, FR-E5 |
| Me: progress, export and import, privacy | M | FR-P1–P4, NFR-S |
| Settings | M | FR-S1 |
| Provenance panel (internal) | V | CI-5 |
