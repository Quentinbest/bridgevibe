import type { Score, ScoreInput } from './scoring';

// US-09.1: hand-calculated 2017 Law 77 examples; descriptions expose the arithmetic.
export const law77Examples = [
  {
    description: '2♣ NV +1: 2 × 20 + 20 overtrick + 50 part-score = 110',
    input: { level: 2, strain: 'clubs', doubling: 'undoubled', vulnerable: false, tricks: 9 },
    expected: { score: 110, breakdown: [{ kind: 'contract-points', points: 40 }, { kind: 'overtricks', points: 20, count: 1 }, { kind: 'part-score-bonus', points: 50 }] },
  },
  {
    description: '1NT NV made: 40 + 50 part-score = 90',
    input: { level: 1, strain: 'no-trumps', doubling: 'undoubled', vulnerable: false, tricks: 7 },
    expected: { score: 90, breakdown: [{ kind: 'contract-points', points: 40 }, { kind: 'part-score-bonus', points: 50 }] },
  },
  {
    description: '3NT V made: 40 + 2 × 30 + 500 game = 600',
    input: { level: 3, strain: 'no-trumps', doubling: 'undoubled', vulnerable: true, tricks: 9 },
    expected: { score: 600, breakdown: [{ kind: 'contract-points', points: 100 }, { kind: 'game-bonus', points: 500 }] },
  },
  {
    description: '4♥ NV made: 4 × 30 + 300 game = 420',
    input: { level: 4, strain: 'hearts', doubling: 'undoubled', vulnerable: false, tricks: 10 },
    expected: { score: 420, breakdown: [{ kind: 'contract-points', points: 120 }, { kind: 'game-bonus', points: 300 }] },
  },
  {
    description: '4♠ V +1: 4 × 30 + 30 overtrick + 500 game = 650',
    input: { level: 4, strain: 'spades', doubling: 'undoubled', vulnerable: true, tricks: 11 },
    expected: { score: 650, breakdown: [{ kind: 'contract-points', points: 120 }, { kind: 'overtricks', points: 30, count: 1 }, { kind: 'game-bonus', points: 500 }] },
  },
  {
    description: '5♣ NV made: 5 × 20 + 300 game = 400',
    input: { level: 5, strain: 'clubs', doubling: 'undoubled', vulnerable: false, tricks: 11 },
    expected: { score: 400, breakdown: [{ kind: 'contract-points', points: 100 }, { kind: 'game-bonus', points: 300 }] },
  },
  {
    description: '6♠ V made: 6 × 30 + 500 game + 750 small slam = 1430',
    input: { level: 6, strain: 'spades', doubling: 'undoubled', vulnerable: true, tricks: 12 },
    expected: { score: 1430, breakdown: [{ kind: 'contract-points', points: 180 }, { kind: 'game-bonus', points: 500 }, { kind: 'slam-bonus', points: 750 }] },
  },
  {
    description: '7NT NV made: 40 + 6 × 30 + 300 game + 1000 grand slam = 1520',
    input: { level: 7, strain: 'no-trumps', doubling: 'undoubled', vulnerable: false, tricks: 13 },
    expected: { score: 1520, breakdown: [{ kind: 'contract-points', points: 220 }, { kind: 'game-bonus', points: 300 }, { kind: 'slam-bonus', points: 1000 }] },
  },
  {
    description: '1♥X NV made: 30 × 2 + 50 insult + 50 part-score = 160',
    input: { level: 1, strain: 'hearts', doubling: 'doubled', vulnerable: false, tricks: 7 },
    expected: { score: 160, breakdown: [{ kind: 'contract-points', points: 60 }, { kind: 'doubled-bonus', points: 50 }, { kind: 'part-score-bonus', points: 50 }] },
  },
  {
    description: '2♥X NV made: 2 × 30 × 2 + 50 insult + 300 game = 470',
    input: { level: 2, strain: 'hearts', doubling: 'doubled', vulnerable: false, tricks: 8 },
    expected: { score: 470, breakdown: [{ kind: 'contract-points', points: 120 }, { kind: 'doubled-bonus', points: 50 }, { kind: 'game-bonus', points: 300 }] },
  },
  {
    description: '3NTXX V +1: (40 + 2 × 30) × 4 + 400 overtrick + 100 insult + 500 game = 1400',
    input: { level: 3, strain: 'no-trumps', doubling: 'redoubled', vulnerable: true, tricks: 10 },
    expected: { score: 1400, breakdown: [{ kind: 'contract-points', points: 400 }, { kind: 'overtricks', points: 400, count: 1 }, { kind: 'doubled-bonus', points: 100 }, { kind: 'game-bonus', points: 500 }] },
  },
  {
    description: '3♦ NV down 1: −1 × 50 = −50',
    input: { level: 3, strain: 'diamonds', doubling: 'undoubled', vulnerable: false, tricks: 8 },
    expected: { score: -50, breakdown: [{ kind: 'undertricks', points: -50, count: 1 }] },
  },
  {
    description: '4♠ V down 2: −2 × 100 = −200',
    input: { level: 4, strain: 'spades', doubling: 'undoubled', vulnerable: true, tricks: 8 },
    expected: { score: -200, breakdown: [{ kind: 'undertricks', points: -200, count: 2 }] },
  },
  {
    description: '4♥X NV down 3: −(100 + 200 + 200) = −500',
    input: { level: 4, strain: 'hearts', doubling: 'doubled', vulnerable: false, tricks: 7 },
    expected: { score: -500, breakdown: [{ kind: 'undertricks', points: -500, count: 3 }] },
  },
  {
    description: '3♠X NV down 4: −(100 + 200 + 200 + 300) = −800',
    input: { level: 3, strain: 'spades', doubling: 'doubled', vulnerable: false, tricks: 5 },
    expected: { score: -800, breakdown: [{ kind: 'undertricks', points: -800, count: 4 }] },
  },
  {
    description: '2♠X V down 2: −(200 + 300) = −500',
    input: { level: 2, strain: 'spades', doubling: 'doubled', vulnerable: true, tricks: 6 },
    expected: { score: -500, breakdown: [{ kind: 'undertricks', points: -500, count: 2 }] },
  },
] as const satisfies readonly { description: string; input: ScoreInput; expected: Score }[];
