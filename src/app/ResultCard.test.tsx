// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { completedRecord, OBJECTIVES, scoreMiniBridge, startPlaythrough, SUITS } from '../table';
import { catalogue } from '../explanation';
import { completeFixedDeal } from '../../test/strategy';
import { ResultCard } from './ResultCard';
import { ReviewScreen } from './ReviewScreen';

afterEach(cleanup);
const base = completeFixedDeal();
for (const strain of [...SUITS, 'no-trumps'] as const) for (const objective of OBJECTIVES) {
  test(`US-09.4 rendered breakdown matches every ${strain} ${objective} result`, () => {
    for (let tricks = 0; tricks <= 13; tricks++) {
      const record = completedRecord({ ...base, gameFormat: 'minibridge', contract: { ...base.contract, strain },
        result: { northSouth: tricks, eastWest: 13 - tricks }, setupEvents: [{ kind: 'contract-choice', seat: 'south',
          controller: 'learner', action: { kind: 'choose-contract', strain, objective }, provenance: { kind: 'learner' } }] });
      const { container, unmount } = render(<ResultCard record={record} />);
      const expected = scoreMiniBridge({ strain, objective, tricks });
      const goal = objective === 'part-score' ? 7 : strain === 'no-trumps' ? 9 : strain === 'clubs' || strain === 'diamonds' ? 11 : 10;
      const difference = tricks - goal;
      expect(container.querySelector('h2')?.textContent).toBe(difference === 0 ? 'Made exactly.'
        : difference > 0 ? `Made, +${difference}.` : difference === -1 ? 'So close. Down 1.' : `So close. Down ${-difference} tricks.`);
      const sentences = [...container.querySelectorAll('li')].map(item => item.textContent);
      expect(sentences).toHaveLength(expected.breakdown.length);
      expected.breakdown.forEach((item, i) => {
        const amount = Math.abs(item.amount);
        const words = item.kind === 'first-no-trump' ? `The first odd trick in no-trumps adds ${amount} to the score.`
          : item.kind === 'odd-tricks' ? `Odd tricks after the first six: ${item.count} × ${item.value} adds ${amount} to the score.`
            : item.kind === 'tricks-short' ? `Tricks short of the goal: ${item.count} × 50 subtracts ${amount} from the score.`
              : `Making the ${objective} goal adds a bonus of ${amount}.`;
        expect(sentences[i]).toBe(words);
      });
      expect(container.querySelector('.result-score')?.textContent).toBe(`Score: ${expected.score > 0 ? '+' : ''}${expected.score} for North–South`);
      unmount();
    }
  });
}
test('CI-8 result copy is draft and reserves points for HCP', () => {
  const entries = Object.entries(catalogue).filter(([id]) => id.startsWith('result.'));
  expect(entries.length).toBeGreaterThan(15);
  for (const [, entry] of entries) { expect(entry.status).toBe('draft'); expect(entry.text).not.toMatch(/\bpoints\b/i); }
});
test('defending learner sees opposite score; review has the same result and rule reference', () => {
  const table = startPlaythrough({ deal: base.deal, gameFormat: 'minibridge',
    contract: { ...base.contract, declarer: 'east' }, learnerSide: 'northSouth' });
  while (table.seatView('south').turn) {
    const seat = table.seatView('south').turn!;
    const controller = table.controllerOf(seat);
    table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot'
      ? { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } : undefined);
  }
  const record = completedRecord(table.record());
  const signed = -scoreMiniBridge({ strain: 'no-trumps', objective: 'game', tricks: record.result.eastWest }).score;
  const scoreLine = `Score: ${signed > 0 ? '+' : ''}${signed} for North–South`;
  const onReview = vi.fn(), onNext = vi.fn();
  const { container, unmount } = render(<ResultCard record={record} onReview={onReview} onNext={onNext} />);
  const headline = container.querySelector('h2')!.textContent;
  const contract = container.querySelector('.result-contract')!.textContent;
  expect(screen.getByText(scoreLine)).toBeTruthy();
  expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Next deal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review this deal' })); expect(onReview).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Next deal' })); expect(onNext).toHaveBeenCalledOnce();
  unmount();
  render(<ReviewScreen record={record} onBack={() => {}} />);
  expect(screen.getByText(headline!)).toBeTruthy(); expect(screen.getByText(contract!)).toBeTruthy();
  expect(screen.getByText(scoreLine)).toBeTruthy();
  expect(screen.getByText('How scoring works')).toBeTruthy();
});
test('contract-bridge review has no MiniBridge result card', () => {
  render(<ReviewScreen record={completedRecord(base)} onBack={() => {}} />);
  expect(screen.queryByRole('region', { name: 'MiniBridge result' })).toBeNull();
});
