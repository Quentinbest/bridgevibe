import { Dds, loadDds } from 'bridge-dds';
import { RANKS, SEATS, SUITS } from '../table';
import { bridgeDdsEngine, type Layout, type SolverPort } from './index';

export const pbn = (layout: Layout) => 'N:' + SEATS.map(seat => SUITS.map(suit => layout[seat]
  .filter(card => card.suit === suit).map(card => card.rank === '10' ? 'T' : card.rank).join('')).join('.')).join(' ');
let engine: Promise<Dds> | undefined;
const dds = () => engine ??= loadDds().then(module => new Dds(module));
// §4.3.2: solutions=3 includes every legal equivalence class; mode=1 also scores forced cards.
export const bridgeDdsAdapter: SolverPort = {
  ...bridgeDdsEngine,
  async solvePosition(layout, position) {
    const solved = (await dds()).SolveBoardPBN({ remainCards: pbn(layout),
      trump: position.strain === 'no-trumps' ? 4 : SUITS.indexOf(position.strain), first: SEATS.indexOf(position.leader),
      currentTrickSuit: Array.from({ length: 3 }, (_, i) => position.currentTrick[i] ? SUITS.indexOf(position.currentTrick[i].card.suit) : 0),
      currentTrickRank: Array.from({ length: 3 }, (_, i) => position.currentTrick[i] ? 14 - RANKS.indexOf(position.currentTrick[i].card.rank) : 0),
    }, -1, 3, 1);
    return { ...bridgeDdsEngine, classes: Array.from({ length: solved.cards }, (_, i) => ({
      cards: RANKS.filter((_, r) => (solved.equals[i] | (1 << solved.rank[i])) & (1 << (14 - r)))
        .map(rank => ({ suit: SUITS[solved.suit[i]], rank })), tricks: solved.score[i],
    })) };
  },
  async solveTable(layout) { return { ...bridgeDdsEngine, table: (await dds()).CalcDDTablePBN({ cards: pbn(layout) }).resTable }; },
};
