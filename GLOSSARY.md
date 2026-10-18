# BridgeVibe Glossary

The shared language of the BridgeVibe domain. Terms are grouped by bounded context. This file does not describe implementation: no types, services or engines by product name.

**Status markers**
- No marker: resolved.
- **[Provisional · Qn]**: working definition until open question *Qn* in `docs/domain/open-questions.md` is answered. None outstanding at present.
- **Avoid:** words that must not be used for this concept in specifications, code or UI copy, because they mean something else here.

UI copy for teenagers may use friendlier words ("points", "X-ray view"). Those are translations of these terms, and each locale's glossary maps them back here.

---

## 1. Context map

| Context | Responsibility | Kind |
|---|---|---|
| **Table** | The rules of bridge: deals, setup, auction, play, result, score. The only authority on legality | Supporting, authoritative |
| **Information** | What each seat may know; hidden cards; public constraints; sampling and double-dummy analysis | Supporting (generic engines behind it) |
| **Bidding System** | The agreed meaning of calls; coverage | Supporting |
| **Robot Play** | Decisions for seats not controlled by the learner | Supporting |
| **Coaching** | Hints, review, decision assessment, abstention, provenance | **Core** |
| **Curriculum** | Modules, lessons, exercises, prompts | **Core** |
| **Progress** | The learner's attempts and completions | Supporting |
| **Content Governance** | Content identity, versions, validity, teacher sign-off, rights | Supporting |
| **Explanation** | Reason codes, rule references, templates, locale glossaries | Supporting |

**Relationships (upstream → downstream)**
- Table → Information, Robot Play, Coaching, Curriculum. Downstream contexts read Table state only through **Seat Views** or, after completion, the **Playthrough Record**.
- Bidding System → Table (public constraints from the auction), Robot Play, Coaching, Curriculum. All conform to one **Convention Profile** per Playthrough.
- Information → Robot Play, Coaching. Every result carries an **Information Mode**.
- Content Governance → Curriculum, Explanation, Coaching (templates). Nothing unsigned flows downstream.
- Curriculum → Progress. Progress refers to content by **Content ID** and **Content Version**; it never copies content.
- Explanation turns Facts and Reason Codes into words. It never decides anything.

---

## 2. Table

| Term | Definition and rules |
|---|---|
| **Card** | One of 52: a **rank** (2 to 10, J, Q, K, A) in a **suit**. |
| **Suit** | Spades, hearts, diamonds or clubs. |
| **Strain** | A suit or no-trumps. Order for bidding: clubs < diamonds < hearts < spades < no-trumps. *Avoid:* "denomination" outside the rules reference. |
| **Trump suit** | The strain of the Contract, when it is a suit. A no-trump Contract has none. |
| **Seat** | North, East, South or West. Seats are positions, not people. |
| **Side** | A partnership of two Seats: North–South or East–West. *Avoid:* "team". |
| **Hand** | The 13 Cards a Deal assigns to one Seat; during play, the **remaining hand** is those not yet played. *Avoid:* "hand" for one playing of a deal (use Playthrough). |
| **Deal** | A complete assignment of the 52 Cards to the four Seats, 13 each, together with the **Dealer** and **Vulnerability**. Immutable once created; identified by a Deal ID; reproducible from a Seed. Rotating a Deal produces a different Deal. *Avoid:* "board" (except in PBN export), "hand". |
| **Dealer** | The Seat that makes the first Call (Contract Bridge) or the first Announcement (MiniBridge). |
| **Vulnerability** | For each Side, whether higher bonuses and penalties apply. Used by duplicate scoring. Whether MiniBridge uses it is set by its rules specification. |
| **Game Format** | *Contract Bridge* or *MiniBridge*. Determines the Setup and the Scoring Scheme. Card play is identical in both. |
| **Playthrough** | One playing of one Deal, under one Game Format and one Convention Profile, from the start of Setup to a final status: *completed*, *passed out* or *abandoned*. While *in progress* it survives leaving the app and resumes from its last Position on the same device. A retry creates a new Playthrough that branches from a Position of an earlier one. *Avoid:* "hand", "game" (a bridge scoring term), "session", "round" (in bridge, one card from each player). |
| **Setup** | The phase that fixes the Contract: the **Auction** in Contract Bridge, or **MiniBridge Setup**. |
| **Action** | Anything submitted to the Table on a Seat's turn: a Call, a Card Play, or a Contract Choice. The Table **accepts** it or **rejects** it with a Reason Code. A rejected Action does not change the Playthrough. |
| **Controller** | Who decides an Action for a Seat: the Learner or a Robot. The Controller of Dummy's cards is the Controller of Declarer. The learner controls their own Seat in Setup and in defence; when the Learner Side declares, the learner controls Declarer, whichever Seat that is (ADR-0003). |
| **Learner Side** | The Side of the Seat the learner sits in (South in the MVP). Fixed for a Playthrough. |
| **Auction** | The ordered sequence of Calls, starting with the Dealer and rotating clockwise. Once a Bid has been made, ends after three consecutive Passes (whether the last other Call was a Bid, Double or Redouble); with no Bid, ends after four Passes (**Pass-out**). |
| **Call** | Bid, Pass, Double or Redouble. *Avoid:* "bid" as the umbrella word. |
| **Bid** | A Call naming a level (1 to 7) and a Strain. Must be higher than the last Bid: a higher level, or the same level in a higher Strain. |
| **Double** | Legal only when the last Bid was made by an opponent and has not already been doubled; Passes may intervene. |
| **Redouble** | Legal only when the last Bid was made by one's own Side, has been doubled by an opponent, and has not already been redoubled; Passes may intervene. |
| **Pass-out** | An Auction of four Passes. There is no Contract, no play, and a Score of zero. The Playthrough ends with status *passed out*, and its Result is still shown with a one-line explanation. |
| **Contract** | The undertaking that results from Setup: level, Strain, doubling state (undoubled, doubled, redoubled) and Declarer. The Declaring Side must win **level + 6** tricks. A MiniBridge Contract has no Auction and no doubling: it is a Strain plus an **Objective**, see MiniBridge Setup. |
| **Declarer** | In Contract Bridge, the player of the Declaring Side who first named the Contract's Strain in the Auction. In MiniBridge, see MiniBridge Setup. |
| **Dummy** | Declarer's partner. Dummy's Hand is exposed and Declarer chooses its plays. Dummy makes no decisions during play. |
| **Defenders** | The two Seats of the Defending Side. |
| **Opening lead** | The first Card Play, made by the Seat on Declarer's left. In Contract Bridge it is made before Dummy is exposed (a **blind lead**). In MiniBridge, Dummy is exposed first. |
| **Trick** | Four Card Plays, one per Seat, starting with the **lead**. Won by the highest trump played, otherwise by the highest card of the suit led. The winner leads next. |
| **Follow suit** | A Seat holding a card of the suit led must play one. |
| **Show out** | Failing to follow suit. It reveals publicly that the Seat holds no more cards of that suit (a **void**). |
| **Result** | Tricks won by the Declaring Side, stated as *made* (with overtricks) or *down n*. |
| **Score** | The number from the Scoring Scheme for a Result, positive for one Side and negative for the other. *Avoid:* "points" alone (ambiguous with HCP). |
| **Scoring Scheme** | Duplicate contract scoring (WBF Law 77) for Contract Bridge; the named EBU convention for MiniBridge. |
| **High-card points (HCP)** | A = 4, K = 3, Q = 2, J = 1. A count of a Hand, not a Score. |
| **MiniBridge Setup** | Each Seat **announces** its HCP in turn from the Dealer. If each Side holds 20 HCP, the Deal is **redealt**. Otherwise the Side with more HCP declares; within it, the Seat with more HCP is Declarer; on a tie, the one who announced first. Dummy is exposed. Declarer makes a **Contract Choice**: a Strain and an **Objective** (*part-score* or *game*). Each Objective maps to a trick target and score under the MiniBridge Scoring Scheme; the exact targets, whether slam is available and whether Vulnerability applies are fixed by the MiniBridge rules specification, not by this glossary. |
| **Announcement** | A Seat's HCP total in MiniBridge Setup. Computed by the Table and always true. A learner asked to count HCP answers a Prompt; the answer is not an Announcement. |
| **Redeal** | Replacing a 20–20 Deal in MiniBridge. The next Deal is derived deterministically from the Seed. |
| **Position** | The state of a Playthrough after a given sequence of accepted Actions. Two Positions are the same only if they have the same Deal and the same sequence, not just the same number of Actions. A Position can be the starting point of a retry or an Exercise. |
| **Reason Code** | The Table's identifier for why an Action was rejected (for example, *must follow suit*). |
| **Playthrough Record** | The ordered list of accepted Actions of a Playthrough, with its Deal, Game Format, Convention Profile version and the versions of every engine that acted. The source of truth for replay and review (ADR-0002). |
| **Revoke** | In the Laws, failing to follow suit when able. It cannot happen in BridgeVibe, because the Table rejects the Action. Use "rejected play" instead. |

## 3. Information

| Term | Definition and rules |
|---|---|
| **Public Information** | What every Seat knows: the Auction, Announcements, the Contract, the Convention Profile in use, Dummy's Hand once exposed, every Card played, and Show-outs. |
| **Seat View** | What one Seat may legitimately know at a Position: its own remaining Hand plus Public Information. Declarer's Seat View contains Dummy's Hand once it is exposed. Only the Table produces Seat Views (ADR-0001). |
| **Hidden Cards** | For a Seat View, the Cards it does not contain. |
| **Public Constraints** | Facts about Hidden Cards implied by Public Information: announced HCP, voids revealed by Show-outs, and the ranges and shapes implied by Calls under the Convention Profile. |
| **Layout** | One assignment of the Hidden Cards to the unseen Seats. The real Layout is the Deal. |
| **Layout Sample** | A Layout drawn to be consistent with a Seat View and its Public Constraints. |
| **Information Mode** | Every analysis result and Coach Statement is either **VISIBLE** (it depends only on one Seat View) or **ALL_HANDS** (it uses the real Layout). |
| **Double-dummy analysis** | Exact analysis of a Position with the real Layout and perfect play by all Seats. Always ALL_HANDS. Hindsight. |
| **Sampled estimate** | Expected tricks for each candidate Action, averaged over Layout Samples, each finished double-dummy. VISIBLE. Approximate. *Avoid:* "single-dummy" in user copy. |
| **Trick Cost** | For one Action, the double-dummy tricks the acting Side could still win before it minus those after it. Zero or more. ALL_HANDS. |
| **Sample Confidence** | Whether a Sampled estimate used enough Layout Samples to be relied on. Below the threshold, the result is an Abstention (*uncertain*). When the Public Constraints leave few Layouts, all can be enumerated, which counts as full confidence. |
| **Learner View** | What the screen shows the learner. Equals the Seat View of the Seat they control, except in an Exercise with an **Exposure**, or in Review (all four Hands). The Learner View never feeds Robots or computed VISIBLE outputs. |

## 4. Bidding System

| Term | Definition and rules |
|---|---|
| **Bidding System** | A family of agreements, such as SAYC, 2/1 or Acol. Not specific enough to play by on its own. |
| **Convention Profile** | A versioned, complete statement of the agreements in use: ranges, forcing rules, conventions included and excluded. One per Playthrough, shared by all four Seats and the Coach. |
| **Bidding Rule** | One agreement in a Convention Profile, with a stable Rule ID: in a given Auction context, a Call shows a given meaning. |
| **Call Meaning** | What a Call shows under the Convention Profile, derived from the Bidding Rule that matches it. Public Information. |
| **Coverage** | The set of Auctions for which the Convention Profile has a Bidding Rule. An Auction outside it is **uncovered**. Once uncovered, Robots make Fallback Actions, the Coach abstains (*not covered*) on every later Call, and the learner chooses to continue the Auction ungraded or to let it be completed with Fallback Actions for all Seats. |
| **Expected Call** | The Call the Convention Profile prescribes for a Hand in an Auction. |
| **Accepted Alternative** | A different Call that the teachers have approved as also correct in that situation. |

## 5. Robot Play

| Term | Definition and rules |
|---|---|
| **Robot** | A Controller that is not the learner. It decides from its Seat View, the Convention Profile and a Seed only. |
| **Robot Policy** | The method a Robot uses to decide. Interchangeable without changing the rest of the domain. |
| **Fallback Action** | A legal Action taken when the Robot Policy cannot answer: out of Coverage, or out of time. Always marked as a fallback in its provenance. Never presented as following a Bidding Rule. |
| **Seed** | The number that, together with the Actions taken, determines Deals and Robot decisions. |
| **Script** | In an Exercise, the intended line: the Actions every Robot will make, regardless of policy. |

## 6. Coaching

| Term | Definition and rules |
|---|---|
| **Coach** | The part of the product that hints, reviews and assesses. It states Facts; it never decides legality or Score. |
| **Fact** | A verified claim produced by the Table, a Bidding Rule, an analysis, or authored content. Carries an Information Mode and Provenance. |
| **Statement** | A Fact (or Abstention) turned into words by a Template. One Statement has exactly one Information Mode. |
| **Provenance** | The record of what produced a Fact: authored item and version; Rule ID and Convention Profile version; engine name, version, mode and sample count; Template ID. |
| **Abstention** | An explicit non-answer, with one reason: **not covered** (no rule or content applies), **uncertain** (Sample Confidence too low) or **unavailable** (failure or timeout). Never replaced by a substantive default. *Avoid:* "unsupported" as a fourth term; it means *not covered*. |
| **Hint** | A Statement given on the learner's request before they act. Always VISIBLE. Tiers: (a) authored lesson hint; (b) principle; (c) Sampled estimate worded with uncertainty. |
| **Review** | The Coach's account of a completed Playthrough: replay with all four Hands, Trick Costs, Key Moments. |
| **Hindsight Label** | The visible, teacher-approved marking on every ALL_HANDS Statement. |
| **Decision** | An Action (a Call or a Card Play) chosen by the learner when at least two non-equivalent legal Actions existed. A forced play is not a Decision. For a Call, Decision Quality comes from the Expected Call and Accepted Alternatives, and Outcome is not assessed. |
| **Forced Play** | A Card Play where only one legal card, or only Equivalent Actions, remain. May be made automatically (see **Auto-play**). |
| **Auto-play** | A learner setting that makes Forced Plays automatically. Available in Practice; always off in Lessons that teach following suit (modules 1–2). |
| **Equivalent Actions** | Card Plays that cannot differ in outcome: two cards of the same suit in the same Hand, where every card ranking between them has already been played or is in that Hand (for example, Q and J with the 10 nowhere else). They count as one choice. |
| **Decision Quality** | Whether a Decision was **acceptable** on the Seat View. Set by a Teacher Label if one exists; otherwise by the Sampled estimate being within the Acceptability Tolerance of the best alternative. VISIBLE. |
| **Outcome** | Whether the Decision had a Trick Cost greater than zero on the real Layout. ALL_HANDS. |
| **Decision Assessment** | Decision Quality combined with Outcome: **sound** (acceptable, no cost); **good decision, unlucky layout** (acceptable, cost); **lucky** (not acceptable, no cost); **mistake** (not acceptable, cost). A Decision is never called a mistake on Outcome alone, and a lucky Decision is never praised. |
| **Teacher Label** | The teachers' resolved judgement (acceptable or not) for a specific Decision in a specific Position. Overrides the Sampled estimate. |
| **Acceptability Tolerance** | The maximum shortfall in expected tricks from the best alternative for a Decision to be acceptable (provisional: 0.25 over at least 50 Layout Samples). |
| **Key Moment** | One of at most three Decisions (Calls or Card Plays) per Playthrough chosen for Review because its Assessment teaches the most. |
| **Retry** | A new Playthrough branching from a Key Moment or other Position of a completed one. Because the learner has seen all four Hands, its Decisions are assessed for feedback but never recorded as Attempts or counted in progress. |

## 7. Curriculum

| Term | Definition and rules |
|---|---|
| **Curriculum** | The ordered set of Modules. |
| **Module** | A topic, such as *following suit*, made of Lessons. |
| **Lesson** | An ordered set of Exercises with commentary. Declares the Game Format and Convention Profile it assumes. |
| **Exercise** | A fixed Deal or Position, with a Script and Steps. Its Deal passes the Validity Checks. |
| **Step** | One unit of an Exercise: commentary, an Exposure, a scripted Action, or a Prompt. |
| **Prompt** | A Step that asks the learner for an Answer (a Card, a Call, a count, a choice), with Expected Answers. After a wrong Answer, the Exercise continues on the Script. A rejected Action counts as a wrong Answer only if the Prompt declares that it does (for example, in the following-suit module); otherwise it gets rules feedback only. |
| **Expected Answer** | An Answer the author marks correct for a Prompt. A Prompt may have several. |
| **Exposure** | A Step that shows Hidden Cards to the learner for teaching. Changes the Learner View, never any Seat View. |
| **Lesson Hint** | An authored Hint (tier a). It may mention Hidden Cards only after an Exposure of those Cards in the same Exercise. |
| **Practice** | Playing Deals outside a Lesson, against Robots, with Hints on request. |

## 8. Progress

| Term | Definition and rules |
|---|---|
| **Learner** | The person using the product on one device. Anonymous; has an age band from the age gate; no account in the MVP. |
| **Attempt** | The learner's answering of one Prompt in one version of its content. Outcome: **correct** (right first time), **corrected** (wrong, then right without being shown) or **failed** (shown the answer). Also records whether a Hint was used before answering. |
| **Lesson Completion** | A Lesson is complete when every Prompt it declares has an Attempt. The denominator is the Lesson's declared Prompts, never what other learners saw. |
| **Skill Tag** | A label from a stable taxonomy attached to a Prompt or Exercise, naming what it practises. |
| **Progress Record** | The learner's Attempts, Completions and settings, exportable and importable. |
| **Mastery** | Not a domain term until the teachers validate a formula. Must not appear in UI copy. |

## 9. Content Governance

| Term | Definition and rules |
|---|---|
| **Content Item** | Any authored unit that reaches learners: Lesson, Exercise, Template, rules-reference entry, locale glossary entry. |
| **Content ID** | A Content Item's permanent identity. Never reused. |
| **Content Version** | A numbered revision of a Content Item. A new version may change wording, commentary and presentation, but never what counts as correct: changing an Expected Answer, the Deal or the Script needs a new Content ID (ADR-0004). Attempts on earlier versions stay valid. |
| **Validity Check** | An automatic check a Content Item must pass: 52 distinct Cards, 13 per Hand; every scripted Action legal; Expected Answers consistent with the Script and the prose; MiniBridge Deals not 20–20. |
| **Sign-off** | A teacher's recorded approval of one Content Version. Any new version needs new Sign-off. |
| **Regression Set** | A fixed set of Positions and Auctions with signed-off expected Coach output, re-run after any engine or content change. |
| **Rights Record** | The source and licence grant of a Content Item. Required before it ships. |

## 10. Explanation

| Term | Definition and rules |
|---|---|
| **Template** | A signed-off sentence pattern that turns a Fact, Abstention or Reason Code into words for one locale. |
| **Rule Reference** | An entry of the browsable rules reference that a Reason Code or Statement can link to. |
| **Locale Glossary** | For one language, the approved translation of each term in this file, including the teenage-register UI words. |

---

## 11. Invariants

| ID | Invariant |
|---|---|
| INV-1 | The Table is the only authority on legality, turn, trick winners, Result and Score. Every other context submits Actions or reads Seat Views and Records. |
| INV-2 | A Deal contains 52 distinct Cards, 13 per Seat, and never changes. |
| INV-3 | A rejected Action leaves the Playthrough unchanged and has a Reason Code with approved wording. |
| INV-4 | Robot decisions and VISIBLE outputs are functions of one Seat View, the Convention Profile and the Seed. Permuting Hidden Cards consistently with Public Constraints never changes them. |
| INV-5 | Every Statement has exactly one Information Mode and complete Provenance. Every ALL_HANDS Statement carries the Hindsight Label. |
| INV-6 | No ALL_HANDS Statement is shown while the learner still has a Decision to make in that Playthrough. |
| INV-7 | A question that cannot be answered produces an Abstention, never a substantive default. A Robot that cannot answer makes a marked Fallback Action. |
| INV-8 | One Playthrough uses one Convention Profile version for all four Seats and the Coach. |
| INV-9 | A Decision is assessed a mistake only if its Decision Quality is not acceptable. Outcome alone never decides it. |
| INV-10 | Announcements are computed by the Table and always true. |
| INV-11 | Sampled percentages and engine probabilities are never presented as the chance that the learner was right. |
| INV-12 | No Content Version reaches a learner without Sign-off and a Rights Record. |
| INV-13 | Replay and Review read the Playthrough Record. They never regenerate Actions from the Seed. |
| INV-14 | When the Learner Side declares, every Card Play of the Declaring Side is the learner's Decision or forced. |
| INV-15 | What counts as correct for a Content ID never changes across its versions. |
| INV-16 | No Attempt or progress measure is derived from a Decision made after the learner has seen the real Layout of that Deal (Review, Retry). |
