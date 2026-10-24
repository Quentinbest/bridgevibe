# Candidate licence report

T3 / VAL-10 evidence only; the owner decides gate outcomes. Pins are register declarations, not verification of checkout cleanliness.
Byte scans skip files over 52428800 bytes (50 MiB), .git, symlinks and non-regular files. Paths are checkout-relative.
Pass means no issue detected by this assessment, not legal approval or proof of absence. LR-1 inventories candidates, not shipped artefacts. LR-5/6 cover registered rights questions; content provenance still needs review. Static tripwires do not establish run-time behaviour or model provenance.

| Candidate | Pin | Licences found | LR-1 | LR-2 | LR-3 | LR-4 | LR-5 | LR-6 | LR-7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bridge-dds | 1.4.0 | Apache-2.0 | pass | pass | pass | pass | pass | pass | pass |
| macroxue bridge-solver | 630705d97bc9205b7310ce6cecafbfb031b289e6 | Apache-2.0, MIT | pass | pass | pass | pass | pass | pass | pass |
| DDS 3.1 | fe6a6581a13535779eda5d9141aa704b3f6c8965 | Apache-2.0 | pass | pass | pass | pass | pass | pass | pass |
| pons-dds | 12689f0ddbd9a95fd07b4d4bca6c273bb05e640c | Apache-2.0 | pass | pass | pass | pass | pass | pass | pass |
| pons | c865f4a1e7e42c29ca9e6a6f9923ee5de34eda01 | Apache-2.0 | pass | pass | fail | pass | pass | pass | open |
| ts-contractbridge | 8a788cf0a926ea0413f9d21091858bf4dc95bcfc | MIT | pass | pass | pass | pass | pass | pass | pass |
| Bridge-Classroom | f4ec8c097652699394979d667f7a3f38b53f959b | Unlicense | pass | pass | fail | pass | pass | pass | pass |
| Baker-Bridge | 600985422a0b6fc764301c0b087f372512790582 | Unlicense | pass | pass | fail | pass | open | open | pass |
| rusty-bidding-bot | 091175fce9d1e19f8bd3446b0f3a70f703e2bf79 | Apache-2.0, MIT | pass | pass | fail | pass | open | open | pass |
| saycbridge | 6d5c1c0b4ae42442aa9c3fb3010746a8a7cd5462 | BSD-3-Clause | pass | pass | open | pass | pass | pass | open |
| Bridgit | ee9ade9ea2eb159b3959f227d2ac0db22aa710f3 | MIT | pass | pass | pass | pass | pass | pass | pass |
| endplay | 260af100d7dacc0e81babd839d5596ca7f20017a | MIT | pass | pass | pass | pass | pass | pass | pass |
| BEN | ad8608af6e6bfe095863023f344f3cb2cbafec3d | GPL-family | pass | pass | fail | fail | pass | pass | open |

## bridge-dds

Double-dummy analysis — npm:bridge-dds @ 1.4.0

Checkout: node_modules/bridge-dds (repo root); scope: whole checkout.

DDS 2.9 compiled to WebAssembly; package metadata is not licence evidence.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: Apache-2.0

Metadata claims (not grants):
- package.json: Apache-2.0 — match

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- None.

## macroxue bridge-solver

Double-dummy analysis — https://github.com/macroxue/bridge-solver @ 630705d97bc9205b7310ce6cecafbfb031b289e6

Checkout: bridge-solver (candidates root); scope: whole checkout.

WebAssembly solver candidate.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE-APACHE [candidate]: Apache-2.0
- LICENSE-MIT [candidate]: MIT

Metadata claims (not grants):
- None available.

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## DDS 3.1

Double-dummy analysis — https://github.com/dds-bridge/dds @ fe6a6581a13535779eda5d9141aa704b3f6c8965

Checkout: dds (candidates root); scope: whole checkout.

Official WebAssembly build candidate.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: Apache-2.0

Metadata claims (not grants):
- None available.

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## pons-dds

Double-dummy analysis — https://github.com/jdh8/pons-dds @ 12689f0ddbd9a95fd07b4d4bca6c273bb05e640c

Checkout: candidates/pons-dds (candidates root); scope: whole checkout.

Optional solver candidate.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: Apache-2.0

Metadata claims (not grants):
- Cargo.toml: Apache-2.0 — match
- web/Cargo.toml: Apache-2.0 — match

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## pons

Bidding and explanations — https://github.com/jdh8/pons @ c865f4a1e7e42c29ca9e6a6f9923ee5de34eda01

Checkout: candidates/pons (candidates root); scope: whole checkout.

american_instinct() assessment covers the whole crate; a build without american_bba_* weights belongs to #34.

LR-1: **pass**; LR-2: **pass**; LR-3: **fail**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **open**

Licence files:
- LICENSE [candidate]: Apache-2.0

Metadata claims (not grants):
- Cargo.toml: Apache-2.0 — match
- web/Cargo.toml: Apache-2.0 — match

Findings:
- .gitignore: prohibited bytes EPBot
- CHANGELOG.md: prohibited bytes american_bba_
- CHANGELOG.md: prohibited bytes EPBot
- Cargo.toml: prohibited bytes EPBot
- README.md: prohibited bytes EPBot
- benches/support/mod.rs: prohibited bytes EPBot
- docs/ai-bidder/01-foundations.md: prohibited bytes EPBot
- docs/ai-bidder/02-policy-net.md: prohibited bytes EPBot
- docs/ai-bidder/21gf-ledger.md: prohibited bytes EPBot
- docs/ai-bidder/README.md: prohibited bytes EPBot
- docs/ai-bidder/archive/rubensohl-1m-ab.md: prohibited bytes EPBot
- docs/ai-bidder/archive/stronger-floor.md: prohibited bytes EPBot
- docs/ai-bidder/bba-1nt-counter-defense.md: prohibited bytes EPBot
- docs/ai-bidder/bba-1nt-defense.md: prohibited bytes EPBot
- docs/ai-bidder/bba-1nt-minors.md: prohibited bytes EPBot
- docs/ai-bidder/bba-1nt-splinter.md: prohibited bytes EPBot
- docs/ai-bidder/bba-book.md: prohibited bytes EPBot
- docs/ai-bidder/bba-card-audit.md: prohibited bytes EPBot
- docs/ai-bidder/bba-floor.md: prohibited bytes EPBot
- docs/ai-bidder/bba-kickback.md: prohibited bytes american_bba_
- docs/ai-bidder/bba-kickback.md: prohibited bytes EPBot
- docs/ai-bidder/bba-multi-2d.md: prohibited bytes EPBot
- docs/ai-bidder/bba-stayman-transfer-defense.md: prohibited bytes EPBot
- docs/ai-bidder/card-manifold.md: prohibited bytes american_bba_
- docs/ai-bidder/card-manifold.md: prohibited bytes EPBot
- docs/ai-bidder/configured-net.md: prohibited bytes american_bba_
- docs/ai-bidder/configured-net.md: prohibited bytes EPBot
- docs/ai-bidder/doubling-calibration.md: prohibited bytes EPBot
- docs/ai-bidder/evaluator-net.md: prohibited bytes EPBot
- docs/ai-bidder/logit-calibration-session4-handoff.md: prohibited bytes american_bba_
- docs/ai-bidder/logit-calibration.md: prohibited bytes american_bba_
- docs/ai-bidder/muiderberg-1nt-2m-counter-defense-research.md: prohibited bytes EPBot
- docs/ai-bidder/plan.md: prohibited bytes EPBot
- docs/archive/bba-gap-anchor-history.md: prohibited bytes american_bba_
- docs/archive/dutch-system.md: prohibited bytes EPBot
- docs/archive/next-steps-done.md: prohibited bytes EPBot
- docs/archive/one-notrump-competitive-closed.md: prohibited bytes EPBot
- docs/archive/open-source-bidder-survey.md: prohibited bytes EPBot
- docs/bba-gap-campaign.md: prohibited bytes EPBot
- docs/ben-gap-campaign.md: prohibited bytes american_bba_
- docs/ben-gap-campaign.md: prohibited bytes EPBot
- docs/ben-gen-design.md: prohibited bytes EPBot
- docs/bidding-architecture.md: prohibited bytes EPBot
- docs/bidding-options.md: prohibited bytes EPBot
- docs/bidding-performance-handoff.md: prohibited bytes EPBot
- docs/competitive-book.md: prohibited bytes EPBot
- docs/declarative-rows.md: prohibited bytes EPBot
- docs/defensive-auctions-reference.md: prohibited bytes EPBot
- docs/defensive-overcalls.md: prohibited bytes EPBot
- docs/deviation-panel.md: prohibited bytes EPBot
- docs/exact-posterior.md: prohibited bytes EPBot
- docs/floor-rail-campaign.md: prohibited bytes EPBot
- docs/measurement.md: prohibited bytes american_bba_
- docs/measurement.md: prohibited bytes EPBot
- docs/minor-transfer-slam.md: prohibited bytes EPBot
- docs/next-steps.md: prohibited bytes EPBot
- docs/one-notrump-competitive.md: prohibited bytes EPBot
- docs/pdd-bank-ledger.md: prohibited bytes american_bba_
- docs/reader-retirement.md: prohibited bytes EPBot
- docs/reading-drift-handoff.md: prohibited bytes EPBot
- docs/shared-machine-data-gen.md: prohibited bytes EPBot
- docs/shrinkage-plan.md: prohibited bytes american_bba_
- examples/bba-card.rs: prohibited bytes EPBot
- examples/bba-gen/main.rs: prohibited bytes EPBot
- examples/bba-gen/tests.rs: prohibited bytes EPBot
- examples/bba-score/main.rs: prohibited bytes EPBot
- examples/ben-gen/main.rs: prohibited bytes EPBot
- examples/bidding-corpus/main.rs: prohibited bytes EPBot
- examples/bidding-performance/main.rs: prohibited bytes EPBot
- examples/common/mod.rs: prohibited bytes EPBot
- examples/common/oracle/mod.rs: prohibited bytes EPBot
- examples/common/oracle/tests.rs: prohibited bytes EPBot
- examples/dump-evaluator/main.rs: prohibited bytes EPBot
- examples/dump-teacher/main.rs: prohibited bytes EPBot
- examples/dump-teacher/tests.rs: prohibited bytes EPBot
- examples/probe-advance-double/main.rs: prohibited bytes EPBot
- examples/probe-bba-1nt/main.rs: prohibited bytes EPBot
- examples/probe-bba-bilans/main.rs: prohibited bytes EPBot
- examples/probe-bba-book/main.rs: prohibited bytes EPBot
- examples/probe-bba-constraints/main.rs: prohibited bytes EPBot
- examples/probe-bba-conventions/main.rs: prohibited bytes EPBot
- examples/probe-bba-disclosure.rs: prohibited bytes EPBot
- examples/probe-bba-kickback-census.rs: prohibited bytes EPBot
- examples/probe-bba-kickback.rs: prohibited bytes EPBot
- examples/probe-bba-nt-reading.rs: prohibited bytes EPBot
- examples/probe-bba-sensitivity.rs: prohibited bytes EPBot
- examples/probe-card-axes.rs: prohibited bytes EPBot
- examples/probe-direct-defense/main.rs: prohibited bytes EPBot
- examples/probe-reading-sound.rs: prohibited bytes EPBot
- examples/probe-rollout-label.rs: prohibited bytes EPBot
- examples/probe-set-conv.rs: prohibited bytes EPBot
- scripts/ab-a6.sh: prohibited bytes EPBot
- scripts/ab-ben-woolsey-complete.sh: prohibited bytes EPBot
- scripts/ab-declared-agreement.sh: prohibited bytes EPBot
- scripts/ab-disclose.sh: prohibited bytes EPBot
- scripts/ab-lib.sh: prohibited bytes EPBot
- scripts/ab-non-inferiority.sh: prohibited bytes american_bba_
- scripts/ab-nt-invite-rail.sh: prohibited bytes EPBot
- scripts/ab-strong-two-loose-positive.sh: prohibited bytes EPBot
- scripts/ab-strong-two-notrump.sh: prohibited bytes EPBot
- scripts/ab-strong-two-waiting.sh: prohibited bytes EPBot
- scripts/bba-book.sh: prohibited bytes EPBot
- scripts/bba-gen-parallel.sh: prohibited bytes EPBot
- scripts/fold-constant-inputs.py: prohibited bytes american_bba_
- scripts/relabel-worker.sh: prohibited bytes EPBot
- scripts/test-arm-fingerprint.sh: prohibited bytes EPBot
- scripts/wj-calibration.sh: prohibited bytes EPBot
- src/bidding/agreements.rs: prohibited bytes EPBot
- src/bidding/american/competition/two_suiters.rs: prohibited bytes EPBot
- src/bidding/american/notrump/european.rs: prohibited bytes EPBot
- src/bidding/american/notrump/splinter.rs: prohibited bytes EPBot
- src/bidding/card/tests.rs: prohibited bytes EPBot
- src/bidding/card.rs: prohibited bytes EPBot
- src/bidding/features.rs: prohibited bytes EPBot
- src/bidding/instinct.rs: prohibited bytes EPBot
- src/bidding/neural/tests.rs: prohibited bytes american_bba_
- src/bidding/neural.rs: prohibited bytes american_bba_
- src/bidding/neural.rs: prohibited bytes EPBot
- src/bidding/neural_floor.rs: prohibited bytes EPBot
- tests/american_european_minors.rs: prohibited bytes EPBot
- trainer/src/main.rs: prohibited bytes american_bba_
- vendor/ben/BEN-21GF-F.conf: prohibited bytes SuitC
- docs/ai-bidder/bba-1nt-counter-defense.md: prohibited path (LR-3)
- docs/ai-bidder/bba-1nt-defense.md: prohibited path (LR-3)
- docs/ai-bidder/bba-1nt-landy-tree.md: prohibited path (LR-3)
- docs/ai-bidder/bba-1nt-minors.md: prohibited path (LR-3)
- docs/ai-bidder/bba-1nt-splinter.md: prohibited path (LR-3)
- docs/ai-bidder/bba-book.md: prohibited path (LR-3)
- docs/ai-bidder/bba-card-audit.md: prohibited path (LR-3)
- docs/ai-bidder/bba-disclosure-sweep.md: prohibited path (LR-3)
- docs/ai-bidder/bba-floor.md: prohibited path (LR-3)
- docs/ai-bidder/bba-kickback.md: prohibited path (LR-3)
- docs/ai-bidder/bba-multi-2d-opening.md: prohibited path (LR-3)
- docs/ai-bidder/bba-multi-2d.md: prohibited path (LR-3)
- docs/ai-bidder/bba-stayman-transfer-defense.md: prohibited path (LR-3)
- docs/archive/bba-gap-anchor-history.md: prohibited path (LR-3)
- docs/archive/bba-gap-floor-forensic.md: prohibited path (LR-3)
- docs/bba-gap-campaign.md: prohibited path (LR-3)
- examples/bba-card.rs: prohibited path (LR-3)
- examples/bba-decompose: prohibited path (LR-3)
- examples/bba-decompose/fixtures: prohibited path (LR-3)
- examples/bba-decompose/fixtures/ben-v5-shard.json: prohibited path (LR-3)
- examples/bba-decompose/main.rs: prohibited path (LR-3)
- examples/bba-decompose/tests.rs: prohibited path (LR-3)
- examples/bba-gen: prohibited path (LR-3)
- examples/bba-gen/main.rs: prohibited path (LR-3)
- examples/bba-gen/tests.rs: prohibited path (LR-3)
- examples/bba-score: prohibited path (LR-3)
- examples/bba-score/main.rs: prohibited path (LR-3)
- examples/probe-bba-1nt: prohibited path (LR-3)
- examples/probe-bba-1nt/main.rs: prohibited path (LR-3)
- examples/probe-bba-bilans: prohibited path (LR-3)
- examples/probe-bba-bilans/main.rs: prohibited path (LR-3)
- examples/probe-bba-book: prohibited path (LR-3)
- examples/probe-bba-book/main.rs: prohibited path (LR-3)
- examples/probe-bba-constraints: prohibited path (LR-3)
- examples/probe-bba-constraints/main.rs: prohibited path (LR-3)
- examples/probe-bba-conventions: prohibited path (LR-3)
- examples/probe-bba-conventions/main.rs: prohibited path (LR-3)
- examples/probe-bba-disclosure.rs: prohibited path (LR-3)
- examples/probe-bba-kickback-census.rs: prohibited path (LR-3)
- examples/probe-bba-kickback.rs: prohibited path (LR-3)
- examples/probe-bba-nt-reading.rs: prohibited path (LR-3)
- examples/probe-bba-sensitivity.rs: prohibited path (LR-3)
- scripts/ab-landy-bba.sh: prohibited path (LR-3)
- scripts/bba-book-divergence.sh: prohibited path (LR-3)
- scripts/bba-book.sh: prohibited path (LR-3)
- scripts/bba-gen-parallel.sh: prohibited path (LR-3)
- scripts/bba_floor_stats.py: prohibited path (LR-3)
- src/bidding/weights/american_bba_v4.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v4.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v4.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed2.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed2.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed2.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed3.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed3.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed3.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed4.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed4.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed4.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed5.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed5.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed5.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed6.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed6.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed6.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed7.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed7.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed7.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed8.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed8.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_seed8.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_their.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_their.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v6_their.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v8.f32: prohibited path (LR-3)
- src/bidding/weights/american_bba_v8.fixture.json: prohibited path (LR-3)
- src/bidding/weights/american_bba_v8.json: prohibited path (LR-3)
- vendor/bba: prohibited path (LR-3)

Open items:
- DEP-08: LR-3: Some files could not be byte-scanned; see skipped files.
- DEP-08: LR-7: Skipped files may contain additional licence evidence.

Skipped:
- .agents/skills: symlink or non-regular file
- .git: .git excluded

## ts-contractbridge

Rules and state core — https://github.com/RalphLipe/ts-contractbridge @ 8a788cf0a926ea0413f9d21091858bf4dc95bcfc

Checkout: candidates/ts-contractbridge (candidates root); scope: packages/ts-contractbridge.

Candidate scope is packages/ts-contractbridge; other repository licences are context only.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- packages/ts-contractbridge/LICENSE [candidate]: MIT

Metadata claims (not grants):
- packages/ts-contractbridge/package.json: MIT — match

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## Bridge-Classroom

Lesson foundation — https://github.com/bridge-craftwork/Bridge-Classroom @ f4ec8c097652699394979d667f7a3f38b53f959b

Checkout: candidates/Bridge-Classroom (candidates root); scope: whole checkout.

PRD records BBA-based grading; static hits require review of use.

LR-1: **pass**; LR-2: **pass**; LR-3: **fail**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: Unlicense

Metadata claims (not grants):
- src/vendor/bridge-rulebot-wasm/package.json: Unlicense — match

Findings:
- docs/bidding-practice.html: prohibited bytes EPBot
- docs/screenshots/bba-comparison.png: prohibited path (LR-3)

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## Baker-Bridge

Lesson content — https://github.com/bridge-craftwork/Baker-Bridge @ 600985422a0b6fc764301c0b087f372512790582

Checkout: candidates/Baker-Bridge (candidates root); scope: whole checkout.

Code licence does not establish rights to third-party lesson content.

LR-1: **pass**; LR-2: **pass**; LR-3: **fail**; LR-4: **pass**; LR-5: **open**; LR-6: **open**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: Unlicense

Metadata claims (not grants):
- None available.

Findings:
- README.md: prohibited bytes EPBot
- Tools/auction-fixes/BakerBridgeFull-bba.pbn: prohibited bytes EPBot
- Tools/audit_passers.py: prohibited bytes EPBot
- Tools/fill_bba_reject.py: prohibited bytes EPBot
- Tools/fix_curated_passers.py: prohibited bytes EPBot
- Tools/passer-fill-bba-redesign.md: prohibited bytes EPBot
- Tools/passer-fill-phase-a.md: prohibited bytes EPBot
- Tools/passer-fill-phase0-audit.md: prohibited bytes EPBot
- Tools/auction-fixes/BakerBridgeFull-bba.pbn: prohibited path (LR-3)
- Tools/auction-fixes/analyze_bba_diff.py: prohibited path (LR-3)
- Tools/fill_bba_reject.py: prohibited path (LR-3)
- Tools/passer-fill-bba-redesign.md: prohibited path (LR-3)

Open items:
- DEP-08: LR-5: EPBot-filtered deals: selection rights require case-by-case review (PRD LR-3/LR-5).
- DEP-08: LR-6: EPBot-filtered deals: selection rights require case-by-case review (PRD LR-3/LR-5).
- DEP-08: LR-5: Third-party content permission scope is unverified; confirm original site permission before copying (PRD LR-5/LR-6).
- DEP-08: LR-6: Third-party content permission scope is unverified; confirm original site permission before copying (PRD LR-5/LR-6).

Skipped:
- .git: .git excluded

## rusty-bidding-bot

Bidding and explanations — https://github.com/bridge-craftwork/rusty-bidding-bot @ 091175fce9d1e19f8bd3446b0f3a70f703e2bf79

Checkout: candidates/rusty-bidding-bot (candidates root); scope: whole checkout.

WebAssembly bidding candidate; stock convention card origins require review.

LR-1: **pass**; LR-2: **pass**; LR-3: **fail**; LR-4: **pass**; LR-5: **open**; LR-6: **open**; LR-7: **pass**

Licence files:
- LICENSE-APACHE [candidate]: Apache-2.0
- LICENSE-MIT [candidate]: MIT

Metadata claims (not grants):
- Cargo.toml: MIT OR Apache-2.0 — match

Findings:
- CLAUDE.md: prohibited bytes EPBot
- CONTRIBUTING.md: prohibited bytes EPBot
- conventions/notrump/superaccept-doubleton.notes.md: prohibited bytes EPBot
- crates/compare/tests/fixtures/pbs/bba/1N.pbn: prohibited bytes EPBot
- crates/compare/tests/fixtures/pbs/bba/Basic_NT.pbn: prohibited bytes EPBot
- docs/CONTRACT.md: prohibited bytes EPBot
- docs/DESIGN.md: prohibited bytes EPBot
- crates/compare/tests/fixtures/pbs/bba: prohibited path (LR-3)
- crates/compare/tests/fixtures/pbs/bba/1N.pbn: prohibited path (LR-3)
- crates/compare/tests/fixtures/pbs/bba/Basic_NT.pbn: prohibited path (LR-3)
- probes/pools/bba-1nt-15-17-with-5422.txt: prohibited path (LR-3)

Open items:
- DEP-08: LR-5: Bundled stock convention cards need their origin checked (PRD §12.2).
- DEP-08: LR-6: Bundled stock convention cards need their origin checked (PRD §12.2).

Skipped:
- .git: .git excluded

## saycbridge

Bidding and explanations — https://github.com/eseidel/saycbridge @ 6d5c1c0b4ae42442aa9c3fb3010746a8a7cd5462

Checkout: candidates/saycbridge (candidates root); scope: whole checkout.

Python and Z3 server candidate for SAYC.

LR-1: **pass**; LR-2: **pass**; LR-3: **open**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **open**

Licence files:
- LICENSE [candidate]: BSD-3-Clause

Metadata claims (not grants):
- src/pyproject.toml: BSD — unverified

Findings:
- None detected.

Open items:
- DEP-08: LR-3: Some files could not be byte-scanned; see skipped files.
- DEP-08: LR-7: Skipped files may contain additional licence evidence.
- DEP-08: LR-7: src/pyproject.toml: unverified metadata claim BSD.

Skipped:
- .git: .git excluded
- dist/gae/core: symlink or non-regular file
- dist/gae/third_party: symlink or non-regular file
- dist/gae/z3b: symlink or non-regular file

## Bridgit

Bidding and explanations — https://github.com/TricksterCards/Bridgit @ ee9ade9ea2eb159b3959f227d2ac0db22aa710f3

Checkout: candidates/Bridgit (candidates root); scope: whole checkout.

C# bidding candidate for 2/1.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENSE [candidate]: MIT

Metadata claims (not grants):
- None available.

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## endplay

Lesson content — https://github.com/dominicprice/endplay @ 260af100d7dacc0e81babd839d5596ca7f20017a

Checkout: candidates/endplay (candidates root); scope: whole checkout.

Offline content tooling candidate.

LR-1: **pass**; LR-2: **pass**; LR-3: **pass**; LR-4: **pass**; LR-5: **pass**; LR-6: **pass**; LR-7: **pass**

Licence files:
- LICENCE [candidate]: MIT

Metadata claims (not grants):
- pyproject.toml: MIT — match

Findings:
- None detected.

Open items:
- None recorded.

Skipped:
- .git: .git excluded

## BEN

Robot policy — https://github.com/lorserker/ben @ ad8608af6e6bfe095863023f344f3cb2cbafec3d

Checkout: candidates/ben-meta (candidates root); scope: whole checkout.

Deferred server candidate. Metadata only: tree.txt, LICENSE and COMMIT; full repository was too large to clone.

LR-1: **pass**; LR-2: **pass**; LR-3: **fail**; LR-4: **fail**; LR-5: **pass**; LR-6: **pass**; LR-7: **open**

Licence files:
- LICENSE [candidate]: GPL-family

Metadata claims (not grants):
- None available.

Findings:
- tree.txt: prohibited bytes EPBot
- tree.txt: prohibited bytes SuitC
- BBA: prohibited path (LR-3)
- BBA/BBA convention cards: prohibited path (LR-3)
- BBA/BBA convention cards/Bridge Rules.pdf: prohibited path (LR-3)
- BBA/BBA convention cards/Hand Evaluation.pdf: prohibited path (LR-3)
- BBA/BBA convention cards/Sayc.pdf: prohibited path (LR-3)
- BBA/BBA convention cards/WBRIDGE5 - SAYC.INI: prohibited path (LR-3)
- BBA/BBA convention cards/WBRIDGE5 - SEF.INI: prohibited path (LR-3)
- BBA/BBA convention cards/WBRIDGE5 - WB5.INI: prohibited path (LR-3)
- BBA/BBA convention cards/WBRIDGE5.INI: prohibited path (LR-3)
- BBA/CC: prohibited path (LR-3)
- BBA/CC/Acol.bbsa: prohibited path (LR-3)
- BBA/CC/BBA-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/BBA-Sayc.bbsa: prohibited path (LR-3)
- BBA/CC/BEN-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/BEN-SAYC.bbsa: prohibited path (LR-3)
- BBA/CC/BEN-UCBC.bbsa: prohibited path (LR-3)
- BBA/CC/BlueChip-Sayc.bbsa: prohibited path (LR-3)
- BBA/CC/Brill.bbsa: prohibited path (LR-3)
- BBA/CC/GIB-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/GIB-BBO.bbsa: prohibited path (LR-3)
- BBA/CC/LIA-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/Meadowlark.bbsa: prohibited path (LR-3)
- BBA/CC/Meckwell.bbsa: prohibited path (LR-3)
- BBA/CC/Micro Bridge 13.4.bbsa: prohibited path (LR-3)
- BBA/CC/QPlus-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/Robo-Sayc.bbsa: prohibited path (LR-3)
- BBA/CC/Shark-Sayc.bbsa: prohibited path (LR-3)
- BBA/CC/WBridge5-21GF.bbsa: prohibited path (LR-3)
- BBA/CC/WBridge5-Sayc.bbsa: prohibited path (LR-3)
- BBA/CC/WJ.bbsa: prohibited path (LR-3)
- BBA/CC/default.bbsa: prohibited path (LR-3)
- Boards/BBA: prohibited path (LR-3)
- Boards/BBA/1C-1H-1S.pbn: prohibited path (LR-3)
- Boards/BBA/1C-4H.pbn: prohibited path (LR-3)
- Boards/BBA/1C-P-1D-P-1H-P-1S.pbn: prohibited path (LR-3)
- Boards/BBA/1C-P-1S-P-2D-P-2N-P.pbn: prohibited path (LR-3)
- Boards/BBA/1D-P-1H-P-2D-P-2S.pbn: prohibited path (LR-3)
- Boards/BBA/1D-P-4C.pbn: prohibited path (LR-3)
- Boards/BBA/1H-3N.pbn: prohibited path (LR-3)
- Boards/BBA/1H-P-1N-P-2H-P-3H.pbn: prohibited path (LR-3)
- Boards/BBA/1H-P-1S-2D-P-P-X.pbn: prohibited path (LR-3)
- Boards/BBA/1M-3M blocking.pbn: prohibited path (LR-3)
- Boards/BBA/1M-3M inviting.pbn: prohibited path (LR-3)
- Boards/BBA/1N-P-2X-D.pbn: prohibited path (LR-3)
- Boards/BBA/1N-P-P-X.pbn: prohibited path (LR-3)
- Boards/BBA/1S-2D.pbn: prohibited path (LR-3)
- Boards/BBA/1S-3N.pbn: prohibited path (LR-3)
- Boards/BBA/1X-(1Y)-2Z weak.pbn: prohibited path (LR-3)
- Boards/BBA/1_-P-1_-P-3_.pbn: prohibited path (LR-3)
- Boards/BBA/1m opening allows 5M.pbn: prohibited path (LR-3)
- Boards/BBA/2 level overcall.pbn: prohibited path (LR-3)
- Boards/BBA/2Openings.pbn: prohibited path (LR-3)
- Boards/BBA/3Openings.pbn: prohibited path (LR-3)
- Boards/BBA/4Openings.pbn: prohibited path (LR-3)
- Boards/BBA/5431 after 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/5MinorOpenings.pbn: prohibited path (LR-3)
- Boards/BBA/5NT pick a slam.pbn: prohibited path (LR-3)
- Boards/BBA/BBA.py: prohibited path (LR-3)
- Boards/BBA/Bergen.pbn: prohibited path (LR-3)
- Boards/BBA/Blackwood 1430.pbn: prohibited path (LR-3)
- Boards/BBA/Chekback.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_1N - redoubled.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_1m opening allows 5M strong.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_2N-opening.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_Michaels Cuebid.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_Multi-Landy.pbn: prohibited path (LR-3)
- Boards/BBA/Cleaned_Unusual 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Cue bid.pbn: prohibited path (LR-3)
- Boards/BBA/Drury.pbn: prohibited path (LR-3)
- Boards/BBA/Exclusion.pbn: prohibited path (LR-3)
- Boards/BBA/Fit showing jumps.pbn: prohibited path (LR-3)
- Boards/BBA/Forcing 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Fourth suit.pbn: prohibited path (LR-3)
- Boards/BBA/Gambling.pbn: prohibited path (LR-3)
- Boards/BBA/Gazzilli.pbn: prohibited path (LR-3)
- Boards/BBA/Gerber.pbn: prohibited path (LR-3)
- Boards/BBA/Ghestem.pbn: prohibited path (LR-3)
- Boards/BBA/Inverted minors.pbn: prohibited path (LR-3)
- Boards/BBA/Jacoby 2NT.pbn: prohibited path (LR-3)
- Boards/BBA/Jordan Truscott 2NT.pbn: prohibited path (LR-3)
- Boards/BBA/Kickback 1430.pbn: prohibited path (LR-3)
- Boards/BBA/King ask by 5NT.pbn: prohibited path (LR-3)
- Boards/BBA/Leaping Michaels.pbn: prohibited path (LR-3)
- Boards/BBA/Lebensohl after 1m.pbn: prohibited path (LR-3)
- Boards/BBA/Lebensohl after double.pbn: prohibited path (LR-3)
- Boards/BBA/Maximal Doubles.pbn: prohibited path (LR-3)
- Boards/BBA/Minor Suit Stayman after 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Minor Suit Stayman after 2NT.pbn: prohibited path (LR-3)
- Boards/BBA/Mixed raise.pbn: prohibited path (LR-3)
- Boards/BBA/Namyats.pbn: prohibited path (LR-3)
- Boards/BBA/Ogust.pbn: prohibited path (LR-3)
- Boards/BBA/Opener reverses.pbn: prohibited path (LR-3)
- Boards/BBA/Overcall - 1 level.pbn: prohibited path (LR-3)
- Boards/BBA/P-1S-P-1N-P-2D-P-3S.pbn: prohibited path (LR-3)
- Boards/BBA/P-1S-P-1N-P-3C-P-3_.pbn: prohibited path (LR-3)
- Boards/BBA/P-1_-X-P-1N-P-3N-P-P-P.pbn: prohibited path (LR-3)
- Boards/BBA/P-2N-P-3D-P-4H.pbn: prohibited path (LR-3)
- Boards/BBA/P-2N-P-3H-P-4S.pbn: prohibited path (LR-3)
- Boards/BBA/Penalty Pass.pbn: prohibited path (LR-3)
- Boards/BBA/Quantitative 4NT.pbn: prohibited path (LR-3)
- Boards/BBA/Raptor 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Redoubles.pbn: prohibited path (LR-3)
- Boards/BBA/RemoveClosedRoom.py: prohibited path (LR-3)
- Boards/BBA/Responsive double.pbn: prohibited path (LR-3)
- Boards/BBA/Semi forcing 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Slam over 1N.pbn: prohibited path (LR-3)
- Boards/BBA/Smolen.pbn: prohibited path (LR-3)
- Boards/BBA/Snapdragon Double.pbn: prohibited path (LR-3)
- Boards/BBA/Soloway Jump Shifts.pbn: prohibited path (LR-3)
- Boards/BBA/Splinter.pbn: prohibited path (LR-3)
- Boards/BBA/Support 1NT.pbn: prohibited path (LR-3)
- Boards/BBA/Support double redouble.pbn: prohibited path (LR-3)
- Boards/BBA/Texas.pbn: prohibited path (LR-3)
- Boards/BBA/Two Way New Minor Forcing.pbn: prohibited path (LR-3)
- Boards/BBA/Two suit takeout double.pbn: prohibited path (LR-3)
- Boards/BBA/Two way game tries.pbn: prohibited path (LR-3)
- Boards/BBA/Unusual 2NT.pbn: prohibited path (LR-3)
- Boards/BBA/Unusual 4NT.pbn: prohibited path (LR-3)
- Boards/BBA/Weak natural 2D.pbn: prohibited path (LR-3)
- Boards/BBA/Weak natural 2M.pbn: prohibited path (LR-3)
- Boards/BBA/_-1C-P-1D-P-1H-P-1S.pbn: prohibited path (LR-3)
- Boards/BBA/cappelletti.pbn: prohibited path (LR-3)
- Boards/BBA/deals.pbn: prohibited path (LR-3)
- Boards/bid_with_epbot.py: prohibited path (LR-3)
- Boards/train_bba_model.sh: prohibited path (LR-3)
- bin/BBA: prohibited path (LR-3)
- bin/BBA/linux: prohibited path (LR-3)
- bin/BBA/linux/arm64: prohibited path (LR-3)
- bin/BBA/linux/arm64/libEPBot.so: prohibited path (LR-3)
- bin/BBA/linux/x64: prohibited path (LR-3)
- bin/BBA/linux/x64/libEPBot.so: prohibited path (LR-3)
- bin/BBA/macos: prohibited path (LR-3)
- bin/BBA/macos/arm64: prohibited path (LR-3)
- bin/BBA/macos/arm64/libEPBot.dylib: prohibited path (LR-3)
- bin/BBA/windows: prohibited path (LR-3)
- bin/BBA/windows/arm64: prohibited path (LR-3)
- bin/BBA/windows/arm64/EPBot.dll: prohibited path (LR-3)
- bin/BBA/windows/x64: prohibited path (LR-3)
- bin/BBA/windows/x64/EPBot.dll: prohibited path (LR-3)
- bin/BGA: prohibited path (LR-3)
- bin/BGA/linux: prohibited path (LR-3)
- bin/BGA/linux/arm64: prohibited path (LR-3)
- bin/BGA/linux/arm64/BGADLL.so: prohibited path (LR-3)
- bin/BGA/linux/arm64/libdds.so: prohibited path (LR-3)
- bin/BGA/linux/x64: prohibited path (LR-3)
- bin/BGA/linux/x64/BGADLL.so: prohibited path (LR-3)
- bin/BGA/linux/x64/dds.dll: prohibited path (LR-3)
- bin/BGA/linux/x64/libdds.so: prohibited path (LR-3)
- bin/BGA/macos: prohibited path (LR-3)
- bin/BGA/macos/arm64: prohibited path (LR-3)
- bin/BGA/macos/arm64/BGADLL.dylib: prohibited path (LR-3)
- bin/BGA/macos/arm64/libdds.2.9.0.dylib: prohibited path (LR-3)
- bin/BGA/windows: prohibited path (LR-3)
- bin/BGA/windows/arm64: prohibited path (LR-3)
- bin/BGA/windows/arm64/BGADLL.dll: prohibited path (LR-3)
- bin/BGA/windows/arm64/dds.dll: prohibited path (LR-3)
- bin/BGA/windows/x64: prohibited path (LR-3)
- bin/BGA/windows/x64/BGADLL.dll: prohibited path (LR-3)
- bin/BGA/windows/x64/dds.dll: prohibited path (LR-3)
- bin/BGA/windows/x64/libbcalcdds.dll: prohibited path (LR-3)
- scripts/data/epbot: prohibited path (LR-3)
- scripts/data/epbot/BBA_Training.ben: prohibited path (LR-3)
- scripts/data/epbot/Module1.vb: prohibited path (LR-3)
- scripts/data/epbot/README.md: prohibited path (LR-3)
- scripts/data/epbot/ben2pbn.py: prohibited path (LR-3)
- scripts/data/epbot/epbot_input_sample.txt: prohibited path (LR-3)
- scripts/data/epbot/epbot_output_sample.txt: prohibited path (LR-3)
- scripts/data/epbot/epbot_to_bidding_data.py: prohibited path (LR-3)
- scripts/data/epbot/html: prohibited path (LR-3)
- scripts/data/epbot/html/viz.css: prohibited path (LR-3)
- scripts/data/epbot/html/viz.js: prohibited path (LR-3)
- scripts/data/epbot/input.bba: prohibited path (LR-3)
- scripts/data/epbot/input.ben: prohibited path (LR-3)
- scripts/data/epbot/printdealtraining.py: prohibited path (LR-3)
- scripts/data/epbot/training.txt: prohibited path (LR-3)
- scripts/data/epbot/training2pbn.py: prohibited path (LR-3)
- src/bba: prohibited path (LR-3)
- src/bba/BBA.py: prohibited path (LR-3)
- src/bba/__init__.py: prohibited path (LR-3)
- src/bba/test_bid hand.py: prohibited path (LR-3)
- src/bba/test_bid.py: prohibited path (LR-3)
- src/bba/test_bid_wsl.sh: prohibited path (LR-3)
- src/bba/test_explanation.py: prohibited path (LR-3)
- src/bba/test_find_aces.py: prohibited path (LR-3)
- src/bba/test_info.py: prohibited path (LR-3)
- src/bba/test_listbids.py: prohibited path (LR-3)
- src/bba/test_sample.py: prohibited path (LR-3)
- src/config/BBA-21GF.conf: prohibited path (LR-3)
- src/config/BBA-Sayc.conf: prohibited path (LR-3)
- src/frontend/views/bba.tpl: prohibited path (LR-3)
- src/suitc: prohibited path (LR-3)
- src/suitc/Command line options.png: prohibited path (LR-3)
- src/suitc/How BEN uses SuitC.pdf: prohibited path (LR-3)
- src/suitc/SuitC.py: prohibited path (LR-3)
- src/suitc/suitc_worker.py: prohibited path (LR-3)
- src/suitc/test.py: prohibited path (LR-3)
- src/suitc/test_tricks.py: prohibited path (LR-3)
- src/test_bba_native.py: prohibited path (LR-3)
- GPL-family: not usable in the browser bundle; server use needs separate review (LR-4).

Open items:
- DEP-08: LR-3: Metadata-only checkout: tree paths checked; repository file contents unavailable.
- DEP-08: LR-7: Metadata-only checkout: nested licence files and package claims unavailable.
- DEP-08: LR-4: Review server use or an explicit non-GPL election; no election is made by this report.

Skipped:
- None.
