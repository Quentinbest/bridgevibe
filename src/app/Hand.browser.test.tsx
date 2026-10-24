import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { cleanup, render, screen } from '@testing-library/react';
import { Hand } from './Hand';
import type { Card } from '../table';
import './tokens.css';
import './styles.css';

afterEach(cleanup);
// US-03.1: at desktop widths an empty (void) suit must not add a second overlap and bury the card before it.
test('a void suit keeps every card 44px exposed and clickable at desktop width', async () => {
  await page.viewport(1440, 900);
  const cards: Card[] = [{ suit: 'spades', rank: '4' }, ...(['A', 'J', '5', '2'] as const).map(rank => ({ suit: 'diamonds' as const, rank })),
    ...(['K', 'Q', '8'] as const).map(rank => ({ suit: 'clubs' as const, rank }))];
  render(<Hand cards={cards} active legalCards={[cards[0]]} selected={null} onSelect={() => {}} onPlay={() => {}} />);
  const buttons = screen.getAllByRole('button');
  for (let i = 0; i + 1 < buttons.length; i++) {
    const box = buttons[i].getBoundingClientRect(), next = buttons[i + 1].getBoundingClientRect();
    expect(next.left - box.left).toBeGreaterThanOrEqual(44);
    expect(document.elementFromPoint(box.left + 22, box.top + box.height / 2)?.closest('button')).toBe(buttons[i]);
  }
});
