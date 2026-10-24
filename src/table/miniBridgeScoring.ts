import { SUITS } from './index';
import { sideOf, type CompletedPlaythroughRecord } from './playthrough';
import type { Contract } from './playthrough';
import { OBJECTIVES, trickTarget, type Objective } from './miniBridgeRules';

export type MiniBridgeScoreItem = Readonly<{
  kind: 'odd-tricks' | 'first-no-trump' | 'part-score-bonus' | 'game-bonus' | 'tricks-short';
  count: number;
  value: number;
  amount: number;
}>;
export type MiniBridgeScore = Readonly<{ score: number; breakdown: readonly MiniBridgeScoreItem[] }>;
export type MiniBridgeScoreInput = Readonly<{ strain: Contract['strain']; objective: Objective; tricks: number }>;

// US-09.2–4, DEP-01 Laws 16–17: signed score for the Declaring Side.
export function scoreMiniBridge(input: MiniBridgeScoreInput): MiniBridgeScore {
  if (!input || typeof input !== 'object') throw new RangeError('input must be an object');
  const { strain, objective, tricks } = input;
  if (![...SUITS, 'no-trumps'].includes(strain)) throw new RangeError('strain is unknown');
  if (!OBJECTIVES.includes(objective)) throw new RangeError('objective is unknown');
  if (!Number.isInteger(tricks) || tricks < 0 || tricks > 13) throw new RangeError('tricks must be an integer from 0 to 13');
  const breakdown: MiniBridgeScoreItem[] = [];
  const add = (kind: MiniBridgeScoreItem['kind'], count: number, value: number) => {
    breakdown.push({ kind, count, value, amount: count * value });
  };
  const short = trickTarget(strain, objective) - tricks;
  if (short > 0) add('tricks-short', short, -50);
  else {
    if (strain === 'no-trumps') {
      add('first-no-trump', 1, 40);
      if (tricks > 7) add('odd-tricks', tricks - 7, 30);
    } else add('odd-tricks', tricks - 6, strain === 'clubs' || strain === 'diamonds' ? 20 : 30);
    add(objective === 'game' ? 'game-bonus' : 'part-score-bonus', 1, objective === 'game' ? 300 : 50);
  }
  return { score: breakdown.reduce((sum, item) => sum + item.amount, 0), breakdown };
}

// INV-1, ADR-0002: Result reads the completed record, including its Contract Choice.
export function miniBridgeResult(record: CompletedPlaythroughRecord) {
  if (record.gameFormat !== 'minibridge' || record.status !== 'completed') throw new RangeError('Result requires completed MiniBridge');
  const contract = record.contract;
  const choice = record.setupEvents?.filter(event => event.kind === 'contract-choice').slice(-1)[0];
  const objective = choice?.action.objective ?? (contract.level === 1 ? 'part-score'
    : contract.level === trickTarget(contract.strain, 'game') - 6 ? 'game' : null);
  if (!objective) throw new RangeError('MiniBridge contract level is unknown');
  const goal = trickTarget(contract.strain, objective);
  const declaringSide = sideOf(contract.declarer);
  const tricks = record.result[declaringSide];
  return { contract, declarer: contract.declarer, declaringSide, objective, goal, tricks,
    made: tricks >= goal, short: Math.max(0, goal - tricks), overtricks: Math.max(0, tricks - goal),
    score: scoreMiniBridge({ strain: contract.strain, objective, tricks }) };
}
