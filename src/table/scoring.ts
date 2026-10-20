import type { Suit } from './index';

export type ScoreInput = Readonly<{
  level: number;
  strain: Suit | 'no-trumps';
  doubling: 'undoubled' | 'doubled' | 'redoubled';
  vulnerable: boolean;
  tricks: number;
}>;
export type ScoreItem = Readonly<{
  kind: 'contract-points' | 'overtricks' | 'doubled-bonus' | 'part-score-bonus'
    | 'game-bonus' | 'slam-bonus' | 'undertricks';
  points: number;
  count?: number;
}>;
export type Score = Readonly<{ score: number; breakdown: readonly ScoreItem[] }>;

// US-09.1, A-01: standalone duplicate scoring, from the declaring side's perspective.
export function scoreContract(input: ScoreInput): Score {
  // US-09.2: untyped callers must pass the same checks as typed callers.
  if (!input || typeof input !== 'object') throw new RangeError('input must be an object');
  const { level, strain, doubling, vulnerable, tricks } = input;
  if (!Number.isInteger(level) || level < 1 || level > 7) throw new RangeError('level must be an integer from 1 to 7');
  if (!['clubs', 'diamonds', 'hearts', 'spades', 'no-trumps'].includes(strain)) throw new RangeError('strain is unknown');
  if (!['undoubled', 'doubled', 'redoubled'].includes(doubling)) throw new RangeError('doubling is unknown');
  if (typeof vulnerable !== 'boolean') throw new RangeError('vulnerable must be a boolean');
  if (!Number.isInteger(tricks) || tricks < 0 || tricks > 13) throw new RangeError('tricks must be an integer from 0 to 13');

  const difference = tricks - level - 6;
  if (difference < 0) {
    const count = -difference;
    let penalty: number;
    if (doubling === 'undoubled') penalty = count * (vulnerable ? 100 : 50);
    else {
      penalty = vulnerable ? 200 + (count - 1) * 300
        : 100 + Math.min(count - 1, 2) * 200 + Math.max(count - 3, 0) * 300;
      if (doubling === 'redoubled') penalty *= 2;
    }
    return { score: -penalty, breakdown: [{ kind: 'undertricks', points: -penalty, count }] };
  }

  const trickValue = strain === 'clubs' || strain === 'diamonds' ? 20 : 30;
  const multiplier = doubling === 'undoubled' ? 1 : doubling === 'doubled' ? 2 : 4;
  const contractPoints = (level * trickValue + (strain === 'no-trumps' ? 10 : 0)) * multiplier;
  const breakdown: ScoreItem[] = [{ kind: 'contract-points', points: contractPoints }];
  if (difference > 0) {
    const overtrickValue = doubling === 'undoubled' ? trickValue : (vulnerable ? 100 : 50) * multiplier;
    breakdown.push({ kind: 'overtricks', points: difference * overtrickValue, count: difference });
  }
  if (doubling !== 'undoubled') breakdown.push({ kind: 'doubled-bonus', points: doubling === 'doubled' ? 50 : 100 });
  breakdown.push(contractPoints >= 100
    ? { kind: 'game-bonus', points: vulnerable ? 500 : 300 }
    : { kind: 'part-score-bonus', points: 50 });
  if (level >= 6) breakdown.push({ kind: 'slam-bonus', points: (level === 6 ? 1 : 2) * (vulnerable ? 750 : 500) });
  return { score: breakdown.reduce((sum, item) => sum + item.points, 0), breakdown };
}
