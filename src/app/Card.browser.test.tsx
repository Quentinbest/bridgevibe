import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Card } from './Card';
import type { Suit } from '../table';
import './tokens.css';
import './styles.css';

afterEach(cleanup);
for (const [suit, two, four] of [
  ['spades', 'rgb(22, 23, 29)', 'rgb(22, 23, 29)'],
  ['hearts', 'rgb(198, 42, 34)', 'rgb(198, 42, 34)'],
  ['diamonds', 'rgb(198, 42, 34)', 'rgb(173, 82, 0)'],
  ['clubs', 'rgb(22, 23, 29)', 'rgb(30, 122, 62)'],
] satisfies [Suit, string, string][]) {
  test(`${suit} uses the default two-colour and optional four-colour palette`, () => {
    const { rerender } = render(<Card card={{ rank: 'A', suit }} />);
    expect(getComputedStyle(screen.getByRole('img')).color).toBe(two);
    rerender(<Card card={{ rank: 'A', suit }} deck="four-colour" />);
    expect(getComputedStyle(screen.getByRole('img')).color).toBe(four);
  });
}
