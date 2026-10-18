import type { Card, Seat } from '../table';

// ADR-0001, US-16.4: the screen is built from what the learner can see. Dummy and the
// learner's own hand are face up; opponents are only a card count, never card identities.
// The full Deal stays out of the app bundle: `fixture.test.ts` checks this view against it.
export type LearnerView = Readonly<{
  dummy: readonly Card[];
  hand: readonly Card[];
  opponentCardCount: Readonly<Partial<Record<Seat, number>>>;
}>;

export const learnerView = {
  dummy: [
    { suit: 'spades', rank: 'A' },
    { suit: 'spades', rank: '5' },
    { suit: 'spades', rank: '2' },
    { suit: 'hearts', rank: 'Q' },
    { suit: 'hearts', rank: '4' },
    { suit: 'diamonds', rank: 'K' },
    { suit: 'diamonds', rank: 'Q' },
    { suit: 'diamonds', rank: '9' },
    { suit: 'diamonds', rank: '7' },
    { suit: 'clubs', rank: 'A' },
    { suit: 'clubs', rank: '9' },
    { suit: 'clubs', rank: '6' },
    { suit: 'clubs', rank: '4' },
  ],
  hand: [
    { suit: 'spades', rank: 'K' },
    { suit: 'spades', rank: '6' },
    { suit: 'spades', rank: '4' },
    { suit: 'hearts', rank: 'A' },
    { suit: 'hearts', rank: '7' },
    { suit: 'hearts', rank: '3' },
    { suit: 'diamonds', rank: 'A' },
    { suit: 'diamonds', rank: 'J' },
    { suit: 'diamonds', rank: '5' },
    { suit: 'diamonds', rank: '2' },
    { suit: 'clubs', rank: 'K' },
    { suit: 'clubs', rank: 'Q' },
    { suit: 'clubs', rank: '8' },
  ],
  opponentCardCount: { west: 13, east: 13 },
} as const satisfies LearnerView;

// Display-only values: no Contract model or play state.
export const display = { contract: 'contract.3nt', declarer: 'south', tricksWon: 0, target: 9 } as const;
