// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { dealFromSeed, rotateDeal, type Deal } from '../table';
import { DealControls } from './DealControls';
import { fixedDeal } from './fixture';

afterEach(cleanup);

function openInfo(deal: Deal) {
  const { container } = render(<DealControls info={{ dealId: deal.dealId, origin: deal.origin }} onNew={() => {}} />);
  // US-07.2: jsdom needs only the native dialog opening behaviour for this component check.
  const dialog = container.querySelector('dialog')!;
  dialog.showModal = () => { dialog.open = true; };
  fireEvent.click(screen.getByRole('button', { name: 'Deal info' }));
  return screen.getByRole('dialog', { name: 'Deal info' });
}

test.each([1, 2, 3])('US-07.2: Deal info shows the recorded rotation %s', rotation => {
  let deal = dealFromSeed('deal-info', 3);
  for (let i = 0; i < rotation; i++) deal = rotateDeal(deal);
  const dialog = openInfo(deal);
  const label = within(dialog).getByText('Rotation', { selector: 'dt' });
  expect(label.nextElementSibling?.tagName).toBe('DD');
  expect(label.nextElementSibling?.textContent).toBe(String(rotation));
  expect(within(dialog).getByTestId('deal-id').textContent).toBe(deal.dealId);
});

test.each([dealFromSeed('deal-info', 3), fixedDeal])('US-07.2: unrotated $origin.kind Deal info keeps its existing fields', deal => {
  const dialog = openInfo(deal);
  expect(within(dialog).queryByText('Rotation')).toBeNull();
  expect([...dialog.querySelectorAll('dt')].map(label => label.textContent)).toEqual(deal.origin.kind === 'seed'
    ? ['Deal ID', 'Origin', 'Seed', 'Deal index', 'Algorithm ID']
    : ['Deal ID', 'Origin', 'Content ID', 'Version']);
});
