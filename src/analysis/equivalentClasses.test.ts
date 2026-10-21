import { expect, test } from 'vitest';
import { type Card, type Seat } from '../table';
import { type Layout, type Position } from './index';
import { equivalentClasses } from './equivalentClasses';

const spade = (rank: Card['rank']): Card => ({ suit: 'spades', rank });
const layoutWith = (cards: readonly Card[], other: Partial<Layout> = {}): Layout => ({ north: [], east: [], south: cards, west: [], ...other });
const score = (cards: readonly Card[], tricks = 3) => cards.map(card => ({ card, tricks }));
const opening: Position = { strain: 'no-trumps', leader: 'south', currentTrick: [] };

test('US-17.2: touching honours form one class, regardless of input order', () => {
  const cards = [spade('Q'), spade('A'), spade('K')];
  expect(equivalentClasses(layoutWith(cards), opening, 'south', score(cards))).toEqual([
    { cards: [spade('A'), spade('K'), spade('Q')], tricks: 3 },
  ]);
});

test.each<Seat>(['east', 'north'])('a gap held by another seat (%s) separates equal-scoring cards', seat => {
  const cards = [spade('K'), spade('J')];
  expect(equivalentClasses(layoutWith(cards, { [seat]: [spade('Q')] }), opening, 'south', score(cards))).toEqual([
    { cards: [spade('K')], tricks: 3 }, { cards: [spade('J')], tricks: 3 },
  ]);
});

test('a gap played in an earlier trick does not separate cards', () => {
  const cards = [spade('K'), spade('J')];
  expect(equivalentClasses(layoutWith(cards), opening, 'south', score(cards))).toEqual([{ cards, tricks: 3 }]);
});

test('a gap card on the current trick separates cards: it can still win the trick', () => {
  // F2 smoke deal-680ce2f85231cb9a: with ♦8 led, ♦9 and ♦7 score differently.
  const cards = [spade('K'), spade('J')];
  const position: Position = { strain: 'no-trumps', leader: 'east', currentTrick: [{ seat: 'east', card: spade('Q') }] };
  expect(equivalentClasses(layoutWith(cards, { east: [spade('10')] }), position, 'south', score(cards))).toEqual([
    { cards: [spade('K')], tricks: 3 }, { cards: [spade('J')], tricks: 3 },
  ]);
});

test('equal scores never merge different suits', () => {
  const cards: Card[] = [spade('A'), { suit: 'hearts', rank: 'A' }];
  expect(equivalentClasses(layoutWith(cards), opening, 'south', score(cards))).toHaveLength(2);
});

test('equivalent cards with inconsistent scores throw', () => {
  const cards = [spade('K'), spade('Q')];
  expect(() => equivalentClasses(layoutWith(cards), opening, 'south', [
    { card: cards[0], tricks: 3 }, { card: cards[1], tricks: 4 },
  ])).toThrow('Equivalent cards have different solver scores');
});
