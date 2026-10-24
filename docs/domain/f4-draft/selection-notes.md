# F4 selection notes — private

**Do not share with graders until labelling is finished.** These algorithmic categories are selection aids, not teacher labels or validated coaching assessments. This is DEP-05 / T7a input, not an app fixture.

Scanned 158 Deals; selected 30. Seed: bv-f4-draft; sampler seed: f4-v1; 50 samples per point; bridge-dds 1.4.0 / DDS 2.9; principlesPolicy version 1.
Correct-play-loses requires every class tied for the highest sampled expected tricks to cost at least 1 double-dummy trick against the best class on the actual layout, and that sampled maximum to exceed at least one other legal class by at least 0.25 tricks. A losing near-best class alone does not qualify.
Fixed scan cap: 1000 seed indices (indices for filled role or strain quotas are skipped). Safety time cap: 15 minutes (abort without replacing outputs). Runtime is printed to the console, excluded here for byte determinism. 20–20 Deals are skipped. Contract scripts alternate NT/longest combined suit and game/part-score. Target trick cycles 1–8; later decisions through trick 8 are searched. Quotas: declaring 4/7/7, defending 2/5/5 (losing/clear/close); 18 NT and 12 suit contracts.
Metrics are remaining tricks for the side to act, including the current trick. Sampled continuation is double-dummy on layouts consistent with the Seat View, an approximation. Close means at least two classes within 0.25 of sampled best with equal actual-layout values; losing-layout takes precedence, then clear. No tolerance is relaxed. Full setup/actions are in positionKey; rotation events may contain full Deals, so the JSON is engineering input, not blind grading material. Give teachers only labelling-sheet.md.

## Decision 1: deal-8eeef0532d608151

Category: close; trick: 1; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":1,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of hearts, King of hearts | 9.76 | 9 |
| 5 of hearts, 4 of hearts | 9.76 | 9 |

Full Deal: dealer north; vulnerability {"northSouth":false,"eastWest":false}.
- north: 9 of spades, 2 of spades, Queen of hearts, 10 of hearts, 8 of hearts, 7 of hearts, 2 of hearts, Ace of diamonds, Queen of diamonds, 10 of diamonds, 3 of diamonds, 2 of diamonds, 10 of clubs
- east: Queen of spades, 6 of spades, 3 of spades, Jack of diamonds, 9 of diamonds, 8 of diamonds, 7 of diamonds, 5 of diamonds, Queen of clubs, Jack of clubs, 8 of clubs, 6 of clubs, 2 of clubs
- south: Ace of spades, Jack of spades, 7 of spades, 5 of spades, 4 of spades, Ace of hearts, King of hearts, 5 of hearts, 4 of hearts, 6 of diamonds, Ace of clubs, 5 of clubs, 4 of clubs
- west: King of spades, 10 of spades, 8 of spades, Jack of hearts, 9 of hearts, 6 of hearts, 3 of hearts, King of diamonds, 4 of diamonds, King of clubs, 9 of clubs, 7 of clubs, 3 of clubs

## Decision 2: deal-c889ac31c5e2fa86

Category: clear; trick: 2; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":2,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Queen of spades | 10.80 | 11 |
| 9 of spades | 10.80 | 11 |
| 3 of spades | 10.80 | 11 |
| 8 of hearts | 9.80 | 10 |
| 3 of hearts | 9.80 | 10 |
| King of diamonds, Queen of diamonds | 10.80 | 11 |
| 10 of diamonds | 10.72 | 11 |
| 3 of diamonds | 10.80 | 11 |
| Ace of clubs | 10.66 | 11 |
| 6 of clubs, 5 of clubs | 8.76 | 9 |

Full Deal: dealer east; vulnerability {"northSouth":true,"eastWest":false}.
- north: Ace of spades, King of spades, 7 of spades, 5 of spades, 4 of spades, 2 of spades, Jack of hearts, 6 of hearts, Ace of diamonds, 9 of diamonds, 2 of diamonds, Jack of clubs, 3 of clubs
- east: Jack of spades, 8 of spades, Ace of hearts, King of hearts, 10 of hearts, 7 of hearts, 5 of hearts, 4 of hearts, Jack of diamonds, 7 of diamonds, 5 of diamonds, 9 of clubs, 2 of clubs
- south: Queen of spades, 9 of spades, 3 of spades, 8 of hearts, 3 of hearts, King of diamonds, Queen of diamonds, 10 of diamonds, 3 of diamonds, Ace of clubs, Queen of clubs, 6 of clubs, 5 of clubs
- west: 10 of spades, 6 of spades, Queen of hearts, 9 of hearts, 2 of hearts, 8 of diamonds, 6 of diamonds, 4 of diamonds, King of clubs, 10 of clubs, 8 of clubs, 7 of clubs, 4 of clubs

## Decision 3: deal-ce58952d76591815

Category: close; trick: 3; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":3,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 6 of spades, 3 of spades | 5.28 | 6 |
| Jack of hearts | 5.58 | 6 |
| King of diamonds, Queen of diamonds, Jack of diamonds | 5.58 | 6 |
| 8 of diamonds | 5.60 | 6 |
| 5 of diamonds | 5.60 | 6 |
| 9 of clubs, 8 of clubs | 5.00 | 6 |
| 6 of clubs | 5.00 | 6 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":true}.
- north: 7 of spades, 4 of spades, 2 of spades, Ace of hearts, King of hearts, 10 of hearts, 8 of hearts, 2 of hearts, Ace of diamonds, Jack of clubs, 7 of clubs, 3 of clubs, 2 of clubs
- east: Queen of spades, Jack of spades, 8 of spades, Queen of hearts, 6 of hearts, 4 of hearts, 10 of diamonds, 6 of diamonds, 4 of diamonds, 3 of diamonds, Ace of clubs, King of clubs, Queen of clubs
- south: King of spades, 9 of spades, 6 of spades, 3 of spades, Jack of hearts, King of diamonds, Queen of diamonds, Jack of diamonds, 8 of diamonds, 5 of diamonds, 9 of clubs, 8 of clubs, 6 of clubs
- west: Ace of spades, 10 of spades, 5 of spades, 9 of hearts, 7 of hearts, 5 of hearts, 3 of hearts, 9 of diamonds, 7 of diamonds, 2 of diamonds, 10 of clubs, 5 of clubs, 4 of clubs

## Decision 4: deal-e7acb33f2dbf7ae0

Category: close; trick: 5; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":4,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 10 of hearts, 9 of hearts, 7 of hearts | 2.06 | 2 |
| 3 of hearts | 2.06 | 2 |

Full Deal: dealer west; vulnerability {"northSouth":true,"eastWest":true}.
- north: 9 of spades, 6 of spades, 5 of spades, King of hearts, 6 of hearts, Ace of diamonds, 10 of diamonds, 7 of diamonds, 5 of diamonds, 2 of diamonds, Jack of clubs, 9 of clubs, 7 of clubs
- east: Queen of spades, 10 of spades, Ace of hearts, Queen of hearts, 5 of hearts, 4 of hearts, 2 of hearts, Queen of diamonds, 9 of diamonds, 8 of diamonds, King of clubs, 6 of clubs, 4 of clubs
- south: King of spades, 3 of spades, 2 of spades, Jack of hearts, 10 of hearts, 9 of hearts, 7 of hearts, 3 of hearts, King of diamonds, Jack of diamonds, 8 of clubs, 3 of clubs, 2 of clubs
- west: Ace of spades, Jack of spades, 8 of spades, 7 of spades, 4 of spades, 8 of hearts, 6 of diamonds, 4 of diamonds, 3 of diamonds, Ace of clubs, Queen of clubs, 10 of clubs, 5 of clubs

## Decision 5: deal-9fef6c2de870c07f

Category: clear; trick: 6; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":5,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 9 of spades, 8 of spades, 7 of spades | 2.54 | 5 |
| 5 of spades | 2.46 | 5 |
| 2 of spades | 2.46 | 5 |
| 5 of clubs, 4 of clubs, 3 of clubs | 1.30 | 3 |

Full Deal: dealer north; vulnerability {"northSouth":true,"eastWest":false}.
- north: Queen of spades, Jack of spades, 10 of spades, 6 of spades, Queen of hearts, 9 of hearts, 5 of hearts, 3 of hearts, 9 of diamonds, 8 of diamonds, Jack of clubs, 9 of clubs, 2 of clubs
- east: Ace of spades, 4 of spades, King of hearts, 10 of hearts, 7 of hearts, 10 of diamonds, 7 of diamonds, 5 of diamonds, 4 of diamonds, 3 of diamonds, King of clubs, 7 of clubs, 6 of clubs
- south: King of spades, 9 of spades, 8 of spades, 7 of spades, 5 of spades, 2 of spades, Jack of hearts, Jack of diamonds, 6 of diamonds, Ace of clubs, 5 of clubs, 4 of clubs, 3 of clubs
- west: 3 of spades, Ace of hearts, 8 of hearts, 6 of hearts, 4 of hearts, 2 of hearts, Ace of diamonds, King of diamonds, Queen of diamonds, 2 of diamonds, Queen of clubs, 10 of clubs, 8 of clubs

## Decision 6: deal-fdbd5cf994ddd51d

Category: close; trick: 6; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":6,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Jack of hearts, 8 of hearts, 7 of hearts, 5 of hearts | 5.00 | 5 |
| King of diamonds | 5.00 | 5 |
| 8 of diamonds | 5.00 | 5 |
| 7 of clubs, 6 of clubs | 5.00 | 5 |

Full Deal: dealer east; vulnerability {"northSouth":false,"eastWest":true}.
- north: King of spades, Queen of spades, King of hearts, 6 of hearts, 2 of hearts, Queen of diamonds, 6 of diamonds, 5 of diamonds, 3 of diamonds, 2 of diamonds, Queen of clubs, Jack of clubs, 10 of clubs
- east: 10 of spades, 5 of spades, 4 of spades, 2 of spades, 10 of hearts, 9 of hearts, 10 of diamonds, 9 of diamonds, 4 of diamonds, 9 of clubs, 8 of clubs, 4 of clubs, 2 of clubs
- south: Ace of spades, 8 of spades, 3 of spades, Queen of hearts, Jack of hearts, 8 of hearts, 7 of hearts, 5 of hearts, 3 of hearts, King of diamonds, 8 of diamonds, 7 of clubs, 6 of clubs
- west: Jack of spades, 9 of spades, 7 of spades, 6 of spades, Ace of hearts, 4 of hearts, Ace of diamonds, Jack of diamonds, 7 of diamonds, Ace of clubs, King of clubs, 5 of clubs, 3 of clubs

## Decision 7: deal-648babe4d8526b2e

Category: close; trick: 7; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":7,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of hearts | 0.00 | 0 |
| 9 of hearts | 0.52 | 0 |
| 7 of hearts | 0.52 | 0 |
| Ace of diamonds | 0.52 | 0 |
| 8 of diamonds | 0.52 | 0 |
| 5 of diamonds, 4 of diamonds | 0.52 | 0 |

Full Deal: dealer south; vulnerability {"northSouth":true,"eastWest":true}.
- north: Queen of spades, 9 of spades, 3 of spades, Ace of hearts, 3 of hearts, 9 of diamonds, 7 of diamonds, 6 of diamonds, 3 of diamonds, Ace of clubs, 8 of clubs, 3 of clubs, 2 of clubs
- east: Ace of spades, King of spades, 10 of spades, 8 of spades, 7 of spades, 6 of spades, 2 of spades, Jack of hearts, 4 of hearts, 10 of diamonds, Jack of clubs, 5 of clubs, 4 of clubs
- south: 4 of spades, King of hearts, Queen of hearts, 9 of hearts, 7 of hearts, 2 of hearts, Ace of diamonds, King of diamonds, Jack of diamonds, 8 of diamonds, 5 of diamonds, 4 of diamonds, 9 of clubs
- west: Jack of spades, 5 of spades, 10 of hearts, 8 of hearts, 6 of hearts, 5 of hearts, Queen of diamonds, 2 of diamonds, King of clubs, Queen of clubs, 10 of clubs, 7 of clubs, 6 of clubs

## Decision 8: deal-dac48f273907be5e

Category: close; trick: 1; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":9,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Jack of spades | 3.08 | 3 |
| 9 of spades | 3.30 | 3 |
| 6 of spades | 3.32 | 3 |
| 3 of spades | 3.32 | 3 |
| 9 of hearts | 3.90 | 3 |
| 5 of hearts, 4 of hearts | 3.94 | 3 |
| 2 of hearts | 3.94 | 3 |
| 10 of diamonds | 3.50 | 3 |
| 6 of diamonds, 5 of diamonds | 3.46 | 3 |
| 7 of clubs, 6 of clubs | 3.90 | 3 |

Full Deal: dealer north; vulnerability {"northSouth":false,"eastWest":true}.
- north: 7 of spades, Ace of hearts, King of hearts, Queen of hearts, 8 of hearts, 6 of hearts, King of diamonds, 9 of diamonds, 4 of diamonds, King of clubs, 10 of clubs, 8 of clubs, 4 of clubs
- east: King of spades, Queen of spades, 4 of spades, Jack of hearts, 10 of hearts, 7 of hearts, 3 of hearts, Ace of diamonds, Jack of diamonds, Ace of clubs, 5 of clubs, 3 of clubs, 2 of clubs
- south: Jack of spades, 9 of spades, 6 of spades, 3 of spades, 9 of hearts, 5 of hearts, 4 of hearts, 2 of hearts, 10 of diamonds, 6 of diamonds, 5 of diamonds, 7 of clubs, 6 of clubs
- west: Ace of spades, 10 of spades, 8 of spades, 5 of spades, 2 of spades, Queen of diamonds, 8 of diamonds, 7 of diamonds, 3 of diamonds, 2 of diamonds, Queen of clubs, Jack of clubs, 9 of clubs

## Decision 9: deal-ff9f79044a513e1b

Category: close; trick: 2; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":10,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of spades | 2.22 | 2 |
| 8 of spades, 7 of spades | 2.14 | 2 |

Full Deal: dealer east; vulnerability {"northSouth":true,"eastWest":true}.
- north: 10 of spades, Jack of hearts, 9 of hearts, 6 of hearts, 3 of hearts, 2 of hearts, Jack of diamonds, 7 of diamonds, 3 of diamonds, 2 of diamonds, 9 of clubs, 7 of clubs, 4 of clubs
- east: King of spades, Queen of spades, 9 of spades, 4 of spades, King of hearts, 8 of hearts, 5 of hearts, Queen of diamonds, 9 of diamonds, Ace of clubs, King of clubs, Jack of clubs, 6 of clubs
- south: Ace of spades, 8 of spades, 7 of spades, Ace of hearts, 10 of hearts, 7 of hearts, King of diamonds, 10 of diamonds, 8 of diamonds, 6 of diamonds, 5 of diamonds, 8 of clubs, 3 of clubs
- west: Jack of spades, 6 of spades, 5 of spades, 3 of spades, 2 of spades, Queen of hearts, 4 of hearts, Ace of diamonds, 4 of diamonds, Queen of clubs, 10 of clubs, 5 of clubs, 2 of clubs

## Decision 10: deal-68b5d8266396d923

Category: clear; trick: 3; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":11,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of spades, Queen of spades | 6.00 | 7 |
| 9 of spades | 2.30 | 2 |
| 7 of hearts, 6 of hearts | 3.30 | 3 |
| 2 of hearts | 3.30 | 3 |
| 10 of diamonds | 6.06 | 8 |
| 8 of diamonds | 6.06 | 8 |
| 3 of diamonds, 2 of diamonds | 6.06 | 8 |
| 7 of clubs | 3.38 | 3 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":false}.
- north: 10 of spades, 8 of spades, 7 of spades, 6 of spades, 3 of spades, King of hearts, 10 of hearts, Ace of diamonds, Queen of diamonds, Jack of diamonds, 10 of clubs, 4 of clubs, 2 of clubs
- east: 4 of spades, Ace of hearts, Queen of hearts, 5 of hearts, 3 of hearts, 7 of diamonds, 6 of diamonds, 5 of diamonds, King of clubs, 9 of clubs, 8 of clubs, 5 of clubs, 3 of clubs
- south: Ace of spades, King of spades, Queen of spades, 9 of spades, 7 of hearts, 6 of hearts, 2 of hearts, 10 of diamonds, 8 of diamonds, 3 of diamonds, 2 of diamonds, Ace of clubs, 7 of clubs
- west: Jack of spades, 5 of spades, 2 of spades, Jack of hearts, 9 of hearts, 8 of hearts, 4 of hearts, King of diamonds, 9 of diamonds, 4 of diamonds, Queen of clubs, Jack of clubs, 6 of clubs

## Decision 11: deal-e80b24ff88f9f1ce

Category: clear; trick: 4; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":12,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 10 of spades | 6.52 | 6 |
| 8 of spades, 7 of spades, 5 of spades | 6.48 | 6 |
| 3 of spades | 6.42 | 6 |
| Ace of hearts | 7.36 | 7 |
| Jack of hearts | 7.26 | 7 |
| 7 of hearts | 7.28 | 7 |
| 7 of diamonds | 6.28 | 6 |
| 5 of clubs | 7.42 | 7 |

Full Deal: dealer west; vulnerability {"northSouth":true,"eastWest":false}.
- north: Jack of spades, 10 of spades, 8 of spades, 7 of spades, 5 of spades, 3 of spades, Ace of hearts, Jack of hearts, 7 of hearts, Ace of diamonds, Jack of diamonds, 7 of diamonds, 5 of clubs
- east: King of spades, Queen of spades, 9 of spades, 4 of spades, Queen of hearts, 8 of hearts, 6 of hearts, 3 of hearts, 6 of diamonds, 5 of diamonds, 4 of diamonds, 10 of clubs, 2 of clubs
- south: 6 of spades, King of hearts, 9 of hearts, 4 of hearts, 2 of hearts, 9 of diamonds, 8 of diamonds, 3 of diamonds, 2 of diamonds, Ace of clubs, King of clubs, Queen of clubs, 4 of clubs
- west: Ace of spades, 2 of spades, 10 of hearts, 5 of hearts, King of diamonds, Queen of diamonds, 10 of diamonds, Jack of clubs, 9 of clubs, 8 of clubs, 7 of clubs, 6 of clubs, 3 of clubs

## Decision 12: deal-064e42b5bbfa850a

Category: clear; trick: 5; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":13,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of spades | 1.90 | 2 |
| Jack of spades | 1.62 | 1 |
| 2 of spades | 2.20 | 3 |
| 8 of hearts, 7 of hearts | 3.04 | 4 |
| 2 of hearts | 3.04 | 4 |
| 8 of clubs, 7 of clubs | 3.20 | 4 |
| 3 of clubs | 2.84 | 4 |

Full Deal: dealer north; vulnerability {"northSouth":true,"eastWest":true}.
- north: King of spades, Jack of spades, 2 of spades, Ace of hearts, 8 of hearts, 7 of hearts, 2 of hearts, Ace of diamonds, Queen of clubs, Jack of clubs, 8 of clubs, 7 of clubs, 3 of clubs
- east: Ace of spades, 10 of spades, 4 of spades, King of hearts, 9 of hearts, 6 of hearts, Queen of diamonds, 8 of diamonds, 7 of diamonds, 6 of diamonds, King of clubs, 9 of clubs, 5 of clubs
- south: 9 of spades, 7 of spades, 10 of hearts, 5 of hearts, 4 of hearts, 3 of hearts, King of diamonds, Jack of diamonds, 10 of diamonds, 9 of diamonds, 2 of diamonds, Ace of clubs, 10 of clubs
- west: Queen of spades, 8 of spades, 6 of spades, 5 of spades, 3 of spades, Queen of hearts, Jack of hearts, 5 of diamonds, 4 of diamonds, 3 of diamonds, 6 of clubs, 4 of clubs, 2 of clubs

## Decision 13: deal-b2d6977c63fd668b

Category: close; trick: 7; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":15,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of spades | 3.08 | 3 |
| Queen of spades | 3.46 | 3 |
| 8 of spades, 7 of spades | 3.76 | 3 |
| 5 of spades | 3.78 | 3 |
| King of diamonds | 2.84 | 3 |
| 5 of diamonds | 3.02 | 3 |

Full Deal: dealer south; vulnerability {"northSouth":true,"eastWest":false}.
- north: King of spades, 10 of spades, 3 of spades, 2 of spades, 10 of hearts, Queen of diamonds, Jack of diamonds, 8 of diamonds, Jack of clubs, 9 of clubs, 8 of clubs, 6 of clubs, 5 of clubs
- east: Jack of spades, Jack of hearts, 8 of hearts, 7 of hearts, 6 of hearts, 2 of hearts, 10 of diamonds, 7 of diamonds, 6 of diamonds, 4 of diamonds, 2 of diamonds, Queen of clubs, 3 of clubs
- south: Ace of spades, Queen of spades, 8 of spades, 7 of spades, 5 of spades, 5 of hearts, 4 of hearts, 3 of hearts, King of diamonds, 5 of diamonds, 3 of diamonds, 10 of clubs, 4 of clubs
- west: 9 of spades, 6 of spades, 4 of spades, Ace of hearts, King of hearts, Queen of hearts, 9 of hearts, Ace of diamonds, 9 of diamonds, Ace of clubs, King of clubs, 7 of clubs, 2 of clubs

## Decision 14: deal-b9dd220458e5e4f5

Category: close; trick: 1; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":17,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 9 of clubs | 6.84 | 8 |
| 2 of clubs | 6.84 | 8 |

Full Deal: dealer north; vulnerability {"northSouth":false,"eastWest":false}.
- north: King of spades, Queen of spades, 8 of spades, 4 of spades, 3 of spades, 2 of hearts, King of diamonds, 10 of diamonds, 7 of diamonds, King of clubs, Queen of clubs, Jack of clubs, 8 of clubs
- east: 5 of spades, 8 of hearts, 5 of hearts, 3 of hearts, Jack of diamonds, 9 of diamonds, 4 of diamonds, 3 of diamonds, Ace of clubs, 7 of clubs, 6 of clubs, 4 of clubs, 3 of clubs
- south: Ace of spades, Jack of spades, 10 of spades, 9 of spades, 7 of spades, Jack of hearts, 7 of hearts, 4 of hearts, Ace of diamonds, 8 of diamonds, 6 of diamonds, 9 of clubs, 2 of clubs
- west: 6 of spades, 2 of spades, Ace of hearts, King of hearts, Queen of hearts, 10 of hearts, 9 of hearts, 6 of hearts, Queen of diamonds, 5 of diamonds, 2 of diamonds, 10 of clubs, 5 of clubs

## Decision 15: deal-771216e91b857fc2

Category: clear; trick: 2; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":18,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 10 of spades | 8.76 | 7 |
| 8 of spades | 8.76 | 7 |
| 5 of spades | 8.76 | 7 |
| 3 of spades | 8.76 | 7 |
| Jack of hearts | 8.16 | 7 |
| 6 of hearts | 8.10 | 7 |
| King of diamonds | 7.46 | 6 |
| 9 of diamonds | 7.46 | 6 |
| King of clubs, Queen of clubs | 8.52 | 7 |
| 10 of clubs | 7.16 | 6 |
| 7 of clubs | 7.16 | 6 |

Full Deal: dealer east; vulnerability {"northSouth":true,"eastWest":false}.
- north: 10 of spades, 8 of spades, 5 of spades, 3 of spades, Ace of hearts, Jack of hearts, 6 of hearts, King of diamonds, 9 of diamonds, King of clubs, Queen of clubs, 10 of clubs, 7 of clubs
- east: 2 of spades, 4 of hearts, 2 of hearts, Queen of diamonds, 8 of diamonds, 7 of diamonds, 3 of diamonds, Ace of clubs, Jack of clubs, 8 of clubs, 6 of clubs, 5 of clubs, 2 of clubs
- south: Ace of spades, Queen of spades, 9 of spades, 7 of spades, King of hearts, Queen of hearts, 10 of hearts, 8 of hearts, 3 of hearts, Jack of diamonds, 2 of diamonds, 9 of clubs, 4 of clubs
- west: King of spades, Jack of spades, 6 of spades, 4 of spades, 9 of hearts, 7 of hearts, 5 of hearts, Ace of diamonds, 10 of diamonds, 6 of diamonds, 5 of diamonds, 4 of diamonds, 3 of clubs

## Decision 16: deal-43829142d724efbb

Category: close; trick: 4; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":19,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 9 of hearts, 8 of hearts, 7 of hearts, 6 of hearts | 0.10 | 0 |
| 4 of hearts | 0.10 | 0 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":true}.
- north: Queen of spades, Jack of spades, 8 of spades, 2 of spades, Jack of hearts, 3 of hearts, 2 of hearts, 6 of diamonds, 5 of diamonds, 3 of diamonds, Ace of clubs, 9 of clubs, 6 of clubs
- east: Ace of spades, 5 of spades, 10 of hearts, 5 of hearts, Ace of diamonds, King of diamonds, Queen of diamonds, Jack of diamonds, 4 of diamonds, 2 of diamonds, 10 of clubs, 7 of clubs, 5 of clubs
- south: 9 of spades, 7 of spades, 6 of spades, 9 of hearts, 8 of hearts, 7 of hearts, 6 of hearts, 4 of hearts, 10 of diamonds, 9 of diamonds, 7 of diamonds, King of clubs, Jack of clubs
- west: King of spades, 10 of spades, 4 of spades, 3 of spades, Ace of hearts, King of hearts, Queen of hearts, 8 of diamonds, Queen of clubs, 8 of clubs, 4 of clubs, 3 of clubs, 2 of clubs

## Decision 17: deal-986de40ef946df5a

Category: clear; trick: 5; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":21,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Queen of spades | 3.94 | 3 |
| 10 of spades | 5.34 | 5 |
| 10 of hearts, 8 of hearts | 6.18 | 4 |
| Queen of diamonds, Jack of diamonds, 10 of diamonds | 6.14 | 5 |
| 4 of diamonds, 2 of diamonds | 6.36 | 5 |

Full Deal: dealer north; vulnerability {"northSouth":true,"eastWest":false}.
- north: King of spades, Queen of spades, 10 of spades, Jack of hearts, 10 of hearts, 8 of hearts, 3 of hearts, Ace of diamonds, Queen of diamonds, Jack of diamonds, 10 of diamonds, 4 of diamonds, 2 of diamonds
- east: Jack of spades, 9 of spades, 8 of spades, 2 of spades, 9 of hearts, 5 of hearts, King of diamonds, 9 of diamonds, 5 of diamonds, Queen of clubs, 10 of clubs, 6 of clubs, 4 of clubs
- south: Ace of spades, 6 of spades, 5 of spades, 3 of spades, King of hearts, 7 of hearts, 4 of hearts, 8 of diamonds, Ace of clubs, King of clubs, 8 of clubs, 5 of clubs, 3 of clubs
- west: 7 of spades, 4 of spades, Ace of hearts, Queen of hearts, 6 of hearts, 2 of hearts, 7 of diamonds, 6 of diamonds, 3 of diamonds, Jack of clubs, 9 of clubs, 7 of clubs, 2 of clubs

## Decision 18: deal-3d56ccf1e02d16bd

Category: close; trick: 6; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":22,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of spades | 7.00 | 7 |
| 4 of spades | 7.00 | 7 |
| Ace of hearts | 7.00 | 7 |
| 10 of hearts, 9 of hearts, 8 of hearts | 7.00 | 7 |
| 10 of diamonds, 8 of diamonds | 7.00 | 7 |

Full Deal: dealer east; vulnerability {"northSouth":false,"eastWest":true}.
- north: King of spades, Queen of spades, 10 of spades, 2 of spades, Jack of hearts, 4 of hearts, 3 of hearts, 9 of diamonds, 7 of diamonds, 6 of diamonds, 3 of diamonds, King of clubs, 7 of clubs
- east: 9 of spades, 8 of spades, 5 of spades, King of hearts, Queen of hearts, Jack of diamonds, Ace of clubs, Queen of clubs, 9 of clubs, 8 of clubs, 5 of clubs, 4 of clubs, 3 of clubs
- south: Ace of spades, 4 of spades, Ace of hearts, 10 of hearts, 9 of hearts, 8 of hearts, Ace of diamonds, Queen of diamonds, 10 of diamonds, 8 of diamonds, 4 of diamonds, Jack of clubs, 10 of clubs
- west: Jack of spades, 7 of spades, 6 of spades, 3 of spades, 7 of hearts, 6 of hearts, 5 of hearts, 2 of hearts, King of diamonds, 5 of diamonds, 2 of diamonds, 6 of clubs, 2 of clubs

## Decision 19: deal-98cbcb601db5b4f9

Category: clear; trick: 7; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":23,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of diamonds | 6.70 | 7 |
| 5 of diamonds | 5.48 | 5 |

Full Deal: dealer south; vulnerability {"northSouth":true,"eastWest":true}.
- north: King of spades, 10 of spades, 7 of spades, Jack of hearts, 2 of hearts, 8 of diamonds, 7 of diamonds, 4 of diamonds, 2 of diamonds, 8 of clubs, 7 of clubs, 5 of clubs, 4 of clubs
- east: Ace of spades, 4 of spades, 10 of hearts, 8 of hearts, 6 of hearts, 4 of hearts, King of diamonds, Queen of diamonds, 10 of diamonds, 6 of diamonds, Ace of clubs, 6 of clubs, 2 of clubs
- south: Queen of spades, 6 of spades, 5 of spades, 2 of spades, Ace of hearts, Queen of hearts, Ace of diamonds, 5 of diamonds, King of clubs, Queen of clubs, Jack of clubs, 9 of clubs, 3 of clubs
- west: Jack of spades, 9 of spades, 8 of spades, 3 of spades, King of hearts, 9 of hearts, 7 of hearts, 5 of hearts, 3 of hearts, Jack of diamonds, 9 of diamonds, 3 of diamonds, 10 of clubs

## Decision 20: deal-c449c43ee07ea399

Category: clear; trick: 1; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":25,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of diamonds, Queen of diamonds, Jack of diamonds, 10 of diamonds | 5.84 | 7 |
| 6 of diamonds | 4.62 | 5 |

Full Deal: dealer north; vulnerability {"northSouth":false,"eastWest":true}.
- north: King of spades, Jack of spades, 5 of spades, 5 of hearts, 4 of hearts, 3 of hearts, Ace of diamonds, 5 of diamonds, 4 of diamonds, 2 of diamonds, 7 of clubs, 6 of clubs, 5 of clubs
- east: Ace of spades, 6 of spades, King of hearts, Jack of hearts, 10 of hearts, 6 of hearts, 2 of hearts, 8 of diamonds, 7 of diamonds, 3 of diamonds, Queen of clubs, 10 of clubs, 4 of clubs
- south: 9 of spades, 3 of spades, 9 of hearts, 8 of hearts, King of diamonds, Queen of diamonds, Jack of diamonds, 10 of diamonds, 6 of diamonds, Ace of clubs, 9 of clubs, 8 of clubs, 3 of clubs
- west: Queen of spades, 10 of spades, 8 of spades, 7 of spades, 4 of spades, 2 of spades, Ace of hearts, Queen of hearts, 7 of hearts, 9 of diamonds, King of clubs, Jack of clubs, 2 of clubs

## Decision 21: deal-e447109979d5accb

Category: close; trick: 5; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":27,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Ace of clubs | 6.12 | 6 |
| 4 of clubs | 6.00 | 6 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":false}.
- north: Ace of spades, Jack of spades, King of hearts, Queen of hearts, Jack of hearts, 9 of hearts, 8 of hearts, Jack of diamonds, 6 of diamonds, 4 of diamonds, 2 of diamonds, Ace of clubs, 4 of clubs
- east: 10 of spades, 8 of spades, 5 of spades, 3 of spades, 10 of hearts, 3 of hearts, 10 of diamonds, 9 of diamonds, 7 of diamonds, 5 of diamonds, 3 of diamonds, King of clubs, 5 of clubs
- south: King of spades, 9 of spades, 6 of spades, 4 of spades, 2 of spades, 7 of hearts, 4 of hearts, 2 of hearts, King of diamonds, Queen of diamonds, Queen of clubs, 9 of clubs, 8 of clubs
- west: Queen of spades, 7 of spades, Ace of hearts, 6 of hearts, 5 of hearts, Ace of diamonds, 8 of diamonds, Jack of clubs, 10 of clubs, 7 of clubs, 6 of clubs, 3 of clubs, 2 of clubs

## Decision 22: deal-1b42bdeef702f129

Category: clear; trick: 5; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":35,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of diamonds, 10 of diamonds | 4.96 | 6 |
| 7 of diamonds | 3.30 | 2 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":true}.
- north: King of spades, 6 of spades, 5 of spades, 4 of spades, 3 of spades, Queen of hearts, Ace of diamonds, 8 of diamonds, 2 of diamonds, Queen of clubs, 9 of clubs, 7 of clubs, 4 of clubs
- east: 10 of spades, 7 of spades, 2 of spades, Jack of hearts, 6 of hearts, 4 of hearts, Jack of diamonds, 3 of diamonds, King of clubs, Jack of clubs, 10 of clubs, 6 of clubs, 2 of clubs
- south: Queen of spades, Jack of spades, 9 of spades, 7 of hearts, 5 of hearts, 3 of hearts, 2 of hearts, King of diamonds, 10 of diamonds, 7 of diamonds, 4 of diamonds, 8 of clubs, 5 of clubs
- west: Ace of spades, 8 of spades, Ace of hearts, King of hearts, 10 of hearts, 9 of hearts, 8 of hearts, Queen of diamonds, 9 of diamonds, 6 of diamonds, 5 of diamonds, Ace of clubs, 3 of clubs

## Decision 23: deal-f27ae4ec98c45988

Category: clear; trick: 8; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":39,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of spades | 1.38 | 0 |
| 5 of spades | 1.26 | 0 |
| 7 of hearts | 0.00 | 0 |
| Jack of diamonds | 2.36 | 1 |
| Jack of clubs | 2.30 | 0 |
| 7 of clubs | 2.20 | 0 |

Full Deal: dealer south; vulnerability {"northSouth":true,"eastWest":true}.
- north: Queen of spades, 10 of spades, 9 of spades, 8 of spades, 7 of spades, 6 of spades, 3 of spades, Ace of hearts, 3 of hearts, Queen of diamonds, 3 of diamonds, 3 of clubs, 2 of clubs
- east: Ace of spades, 2 of spades, 9 of hearts, 8 of hearts, Ace of diamonds, King of diamonds, 10 of diamonds, Ace of clubs, Queen of clubs, 10 of clubs, 9 of clubs, 8 of clubs, 4 of clubs
- south: King of spades, 5 of spades, 4 of spades, Queen of hearts, 7 of hearts, 2 of hearts, Jack of diamonds, 8 of diamonds, 6 of diamonds, 4 of diamonds, Jack of clubs, 7 of clubs, 5 of clubs
- west: Jack of spades, King of hearts, Jack of hearts, 10 of hearts, 6 of hearts, 5 of hearts, 4 of hearts, 9 of diamonds, 7 of diamonds, 5 of diamonds, 2 of diamonds, King of clubs, 6 of clubs

## Decision 24: deal-e2a082153da22bec

Category: clear; trick: 4; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":44,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 9 of spades | 1.44 | 2 |
| 4 of spades | 2.62 | 3 |

Full Deal: dealer west; vulnerability {"northSouth":true,"eastWest":false}.
- north: Ace of spades, Jack of spades, 7 of hearts, 6 of hearts, 4 of hearts, 3 of hearts, Queen of diamonds, 6 of diamonds, 3 of diamonds, Queen of clubs, 7 of clubs, 5 of clubs, 2 of clubs
- east: Queen of spades, 5 of spades, 2 of spades, Ace of hearts, 10 of hearts, 8 of hearts, Jack of diamonds, 8 of diamonds, 2 of diamonds, Ace of clubs, King of clubs, 8 of clubs, 4 of clubs
- south: 9 of spades, 6 of spades, 4 of spades, 3 of spades, Queen of hearts, 9 of hearts, 5 of hearts, King of diamonds, 10 of diamonds, 7 of diamonds, Jack of clubs, 9 of clubs, 6 of clubs
- west: King of spades, 10 of spades, 8 of spades, 7 of spades, King of hearts, Jack of hearts, 2 of hearts, Ace of diamonds, 9 of diamonds, 5 of diamonds, 4 of diamonds, 10 of clubs, 3 of clubs

## Decision 25: deal-cffe2717f1591b6f

Category: correct-play-loses; trick: 8; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":57,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of hearts, Queen of hearts | 1.56 | 2 |
| 10 of hearts | 1.70 | 2 |
| 8 of clubs, 7 of clubs | 1.06 | 3 |
| 5 of clubs | 1.06 | 3 |

Full Deal: dealer north; vulnerability {"northSouth":false,"eastWest":true}.
- north: King of spades, 9 of spades, 6 of spades, Ace of hearts, 8 of hearts, Ace of diamonds, Jack of diamonds, 10 of diamonds, 9 of diamonds, 6 of diamonds, 5 of diamonds, Queen of clubs, Jack of clubs
- east: Queen of spades, Jack of spades, 8 of spades, 3 of spades, 2 of spades, 6 of hearts, 2 of hearts, 8 of diamonds, 3 of diamonds, Ace of clubs, 6 of clubs, 4 of clubs, 3 of clubs
- south: 7 of spades, 5 of spades, King of hearts, Queen of hearts, 10 of hearts, 9 of hearts, King of diamonds, Queen of diamonds, 7 of diamonds, 8 of clubs, 7 of clubs, 5 of clubs, 2 of clubs
- west: Ace of spades, 10 of spades, 4 of spades, Jack of hearts, 7 of hearts, 5 of hearts, 4 of hearts, 3 of hearts, 4 of diamonds, 2 of diamonds, King of clubs, 10 of clubs, 9 of clubs

## Decision 26: deal-e5ba19237b5fc504

Category: correct-play-loses; trick: 8; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":83,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of hearts, Jack of hearts | 2.64 | 5 |
| 2 of diamonds | 4.56 | 4 |
| 10 of clubs | 5.24 | 4 |
| 5 of clubs | 5.24 | 4 |
| 3 of clubs | 5.24 | 4 |

Full Deal: dealer south; vulnerability {"northSouth":false,"eastWest":true}.
- north: Queen of spades, 10 of spades, King of hearts, Jack of hearts, 10 of hearts, 5 of hearts, Ace of diamonds, King of diamonds, 2 of diamonds, King of clubs, 10 of clubs, 5 of clubs, 3 of clubs
- east: Ace of spades, King of spades, Jack of spades, 9 of spades, 7 of spades, 6 of spades, Queen of hearts, 8 of hearts, 7 of hearts, 10 of diamonds, 6 of diamonds, 4 of diamonds, 7 of clubs
- south: 4 of spades, 3 of spades, 2 of spades, 4 of hearts, Queen of diamonds, Jack of diamonds, 9 of diamonds, 5 of diamonds, 3 of diamonds, Queen of clubs, 9 of clubs, 4 of clubs, 2 of clubs
- west: 8 of spades, 5 of spades, Ace of hearts, 9 of hearts, 6 of hearts, 3 of hearts, 2 of hearts, 8 of diamonds, 7 of diamonds, Ace of clubs, Jack of clubs, 8 of clubs, 6 of clubs

## Decision 27: deal-018abef26c81a844

Category: correct-play-loses; trick: 6; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":92,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 5 of spades, 4 of spades | 6.66 | 5 |
| Queen of hearts | 6.32 | 7 |
| 9 of hearts, 8 of hearts, 7 of hearts, 5 of hearts | 6.18 | 6 |
| 3 of diamonds | 6.20 | 6 |

Full Deal: dealer west; vulnerability {"northSouth":true,"eastWest":false}.
- north: King of spades, 8 of spades, 5 of spades, 4 of spades, Ace of hearts, Queen of hearts, 9 of hearts, 8 of hearts, 7 of hearts, 5 of hearts, 3 of hearts, Ace of diamonds, 3 of diamonds
- east: 10 of spades, 7 of spades, 6 of spades, Jack of hearts, 10 of hearts, 6 of hearts, Queen of diamonds, 10 of diamonds, 9 of diamonds, 7 of diamonds, 5 of diamonds, 5 of clubs, 2 of clubs
- south: Ace of spades, Jack of spades, 9 of spades, 3 of spades, 2 of spades, King of hearts, 4 of hearts, Jack of diamonds, 8 of diamonds, 2 of diamonds, 9 of clubs, 7 of clubs, 3 of clubs
- west: Queen of spades, 2 of hearts, King of diamonds, 6 of diamonds, 4 of diamonds, Ace of clubs, King of clubs, Queen of clubs, Jack of clubs, 10 of clubs, 8 of clubs, 6 of clubs, 4 of clubs

## Decision 28: deal-b177d0711317bfb5

Category: correct-play-loses; trick: 6; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":122,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| 7 of spades | 4.54 | 6 |
| 7 of hearts, 4 of hearts, 3 of hearts | 5.24 | 5 |
| Ace of clubs, King of clubs | 4.02 | 5 |
| 9 of clubs | 5.04 | 6 |
| 6 of clubs | 5.04 | 6 |

Full Deal: dealer east; vulnerability {"northSouth":true,"eastWest":true}.
- north: 10 of spades, 7 of spades, Ace of hearts, 8 of hearts, 7 of hearts, 4 of hearts, 3 of hearts, 9 of diamonds, 7 of diamonds, Ace of clubs, King of clubs, 9 of clubs, 6 of clubs
- east: 6 of spades, 5 of spades, 3 of spades, 2 of spades, King of hearts, 5 of hearts, Queen of diamonds, 10 of diamonds, Queen of clubs, Jack of clubs, 7 of clubs, 4 of clubs, 3 of clubs
- south: Ace of spades, Queen of spades, 8 of spades, 4 of spades, Queen of hearts, 2 of hearts, Ace of diamonds, Jack of diamonds, 6 of diamonds, 4 of diamonds, 3 of diamonds, 8 of clubs, 5 of clubs
- west: King of spades, Jack of spades, 9 of spades, Jack of hearts, 10 of hearts, 9 of hearts, 6 of hearts, King of diamonds, 8 of diamonds, 5 of diamonds, 2 of diamonds, 10 of clubs, 2 of clubs

## Decision 29: deal-56174f52aa319499

Category: correct-play-loses; trick: 8; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":230,"rotation":0,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| King of spades | 2.44 | 6 |
| 9 of spades | 2.44 | 6 |
| 7 of spades | 2.44 | 6 |
| 4 of spades | 2.44 | 6 |
| Ace of hearts, 8 of hearts | 3.02 | 3 |

Full Deal: dealer east; vulnerability {"northSouth":false,"eastWest":true}.
- north: Ace of spades, 10 of spades, 8 of spades, 6 of spades, 10 of hearts, Jack of diamonds, 7 of diamonds, 5 of diamonds, 4 of diamonds, 10 of clubs, 9 of clubs, 8 of clubs, 3 of clubs
- east: Queen of spades, 5 of spades, Jack of hearts, 6 of hearts, 4 of hearts, 3 of hearts, Queen of diamonds, 10 of diamonds, 9 of diamonds, 2 of diamonds, King of clubs, 7 of clubs, 5 of clubs
- south: King of spades, 9 of spades, 7 of spades, 4 of spades, 2 of spades, Ace of hearts, Queen of hearts, 8 of hearts, 7 of hearts, 5 of hearts, 3 of diamonds, 4 of clubs, 2 of clubs
- west: Jack of spades, 3 of spades, King of hearts, 9 of hearts, 2 of hearts, Ace of diamonds, King of diamonds, 8 of diamonds, 6 of diamonds, Ace of clubs, Queen of clubs, Jack of clubs, 6 of clubs

## Decision 30: deal-a6db3f0ed42e3ea7

Category: correct-play-loses; trick: 3; samples: 50; origin: {"kind":"seed","seed":"bv-f4-draft","index":394,"rotation":1,"algorithm":"bv-deal-1"}.

| Candidate | Sampled expected tricks | Double-dummy tricks, actual layout |
| --- | --- | --- |
| Jack of spades | 5.36 | 3 |
| 8 of spades | 5.60 | 3 |
| 2 of spades | 5.62 | 4 |
| 10 of hearts | 5.60 | 4 |
| 8 of hearts | 5.60 | 4 |
| King of diamonds | 5.84 | 4 |
| Jack of diamonds | 5.32 | 3 |
| 8 of diamonds | 5.10 | 3 |
| 3 of diamonds | 5.10 | 3 |
| 10 of clubs | 5.68 | 5 |
| 3 of clubs | 5.68 | 5 |

Full Deal: dealer east; vulnerability {"northSouth":true,"eastWest":true}.
- north: 10 of spades, 3 of spades, 9 of hearts, 6 of hearts, 4 of hearts, 3 of hearts, 2 of hearts, 10 of diamonds, 9 of diamonds, King of clubs, Queen of clubs, 9 of clubs, 5 of clubs
- east: King of spades, Queen of spades, 9 of spades, 6 of spades, 5 of spades, Ace of hearts, Jack of hearts, Ace of diamonds, 4 of diamonds, 7 of clubs, 6 of clubs, 4 of clubs, 2 of clubs
- south: Ace of spades, Jack of spades, 8 of spades, 2 of spades, 10 of hearts, 8 of hearts, King of diamonds, Jack of diamonds, 8 of diamonds, 5 of diamonds, 3 of diamonds, 10 of clubs, 3 of clubs
- west: 7 of spades, 4 of spades, King of hearts, Queen of hearts, 7 of hearts, 5 of hearts, Queen of diamonds, 7 of diamonds, 6 of diamonds, 2 of diamonds, Ace of clubs, Jack of clubs, 8 of clubs
