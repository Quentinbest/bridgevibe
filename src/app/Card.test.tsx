// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Card } from './Card';
afterEach(cleanup);
test('Card exposes its full name, rank and suit symbol without interaction', () => {
  render(<Card card={{ rank: 'Q', suit: 'hearts' }} />);
  const card = screen.getByRole('img', { name: 'Queen of hearts' });
  expect(card.textContent).toBe('Q♥');
  expect(screen.queryByRole('button')).toBeNull();
});
test('numeric ranks retain their accessible names', () => {
  render(<Card card={{ rank: '10', suit: 'spades' }} />);
  expect(screen.getByRole('img', { name: '10 of spades' }).textContent).toBe('10♠');
});
