// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { completeFixedDeal } from '../../test/strategy';
import { completedRecord, dealFromSeed, highCardPoints, replay, SEATS, startMiniBridge, type Deal } from '../table';
import { cardName, text } from '../explanation';
import { createPlay } from './play';
import { App } from './App';
import { ReviewScreen } from './ReviewScreen';

afterEach(() => { cleanup(); vi.useRealTimers(); });
test('US-16.1: the composition API refuses early review and the UI has no entry', () => {
  expect(() => createPlay().completedRecord()).toThrow('setup-in-progress');
  render(<App />);
  expect(screen.queryByRole('button', { name: 'Hand review' })).toBeNull();
  expect(screen.queryByRole('note')).toBeNull();
});
test('US-16: completed composition opens review and returns to the table', () => {
  vi.useFakeTimers(); render(<App />);
  act(() => vi.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Game · 9 tricks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
  for (const entry of completeFixedDeal().actions) {
    if (entry.controller === 'robot') act(() => vi.advanceTimersByTime(500));
    else {
      const card = screen.getByRole('button', { name: `${cardName(entry.action.card)}, playable` });
      fireEvent.click(card); fireEvent.click(card);
    }
    if (entry.index % 4 === 3) act(() => vi.advanceTimersByTime(1000));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Hand review' }));
  expect(screen.getByRole('heading', { name: 'Hand review' })).toBe(document.activeElement);
  expect(screen.getByRole('note').textContent).toContain('X-ray view: now you can see all 4 hands');
  fireEvent.click(screen.getByRole('button', { name: 'Back to table' }));
  expect(screen.getByRole('button', { name: 'Hand review' })).toBeTruthy();
});
test('US-16.2: stepper, winner and start-of-trick hands follow the completed record', () => {
  render(<ReviewScreen record={completedRecord(completeFixedDeal())} onBack={() => {}} />);
  expect(screen.queryByRole('heading', { name: 'Announcements' })).toBeNull();
  expect(document.querySelector('.review-strip')!.querySelectorAll('button')).toHaveLength(13);
  expect(screen.getByRole('button', { name: 'Previous trick' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Show all 4 hands' }));
  expect(screen.getByRole('region', { name: 'Hands as trick 1 began' }).querySelectorAll('[aria-label]')).toHaveLength(56);
  fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
  expect(screen.getByText('Trick 2 of 13')).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Hands as trick 2 began' }).querySelectorAll('[aria-label]')).toHaveLength(52);
  for (let n = 2; n < 13; n++) fireEvent.click(screen.getByRole('button', { name: 'Next trick' }));
  expect(screen.getByRole('button', { name: 'Next trick' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Previous trick' }));
  expect(screen.getByText('Trick 12 of 13')).toBeTruthy();
});

test('US-16: the hand disclosure names its next action in both states', () => {
  render(<ReviewScreen record={completedRecord(completeFixedDeal())} onBack={() => {}} />);
  const show = screen.getByRole('button', { name: 'Show all 4 hands', expanded: false });
  expect(show.textContent).toBe('Show all 4 hands');
  fireEvent.click(show);
  const hide = screen.getByRole('button', { name: 'Hide all 4 hands', expanded: true });
  expect(hide.textContent).toBe('Hide all 4 hands');
  expect(screen.getByRole('region', { name: 'Hands as trick 1 began' })).toBeTruthy();
  fireEvent.click(hide);
  expect(screen.getByRole('button', { name: 'Show all 4 hands', expanded: false }).textContent).toBe('Show all 4 hands');
  expect(screen.queryByRole('region', { name: 'Hands as trick 1 began' })).toBeNull();
});


// US-16.2: create complete records through the real setup and card-play Table APIs.
function miniBridgeRecord(predicate: (deal: Deal) => boolean, strain: 'hearts' | 'no-trumps' = 'hearts') {
  let deal: Deal | undefined;
  for (let index = 1; index <= 2000; index++) {
    const candidate = dealFromSeed('minibridge-f1', index);
    if (predicate(candidate)) { deal = candidate; break; }
  }
  if (!deal) throw new Error('Missing deterministic setup case');
  const setup = startMiniBridge({ deal, learnerSide: 'northSouth' });
  for (let n = 0; n < 100 && setup.seatView('south').step !== 'contract-choice'; n++) setup.advance();
  const declarer = setup.seatView('south').declarer!;
  const provenance = { kind: 'robot', policy: 'test', version: '1', durationMs: 0 } as const;
  expect(setup.submit(declarer, setup.controllerOf(declarer), { kind: 'choose-contract', strain, objective: 'game' },
    setup.controllerOf(declarer) === 'robot' ? provenance : undefined).kind).toBe('accepted');
  const table = setup.playthrough()!;
  for (let n = 0; n < 52; n++) {
    const seat = table.seatView('south').turn!, controller = table.controllerOf(seat);
    expect(table.submit(seat, controller, table.legalActions(seat)[0], controller === 'robot' ? provenance : undefined).kind).toBe('accepted');
  }
  return table.completedRecord();
}
const nsPoints = (deal: Deal) => highCardPoints(deal.hands.north) + highCardPoints(deal.hands.south);

test.each([
  ['declaring', (deal: Deal) => nsPoints(deal) > 20],
  ['redeal', (deal: Deal) => nsPoints(deal) === 20],
  ['East declares', (deal: Deal) => nsPoints(deal) < 20 && highCardPoints(deal.hands.east) > highCardPoints(deal.hands.west)],
  ['West declares in a tie', (deal: Deal) => nsPoints(deal) < 20 && highCardPoints(deal.hands.east) === highCardPoints(deal.hands.west) && deal.dealer === 'west'],
] as const)('US-16.2: %s setup positions read recorded facts and show all dealt cards', (scenario, predicate) => {
  const record = miniBridgeRecord(predicate, scenario === 'declaring' ? 'no-trumps' : 'hearts');
  const events = record.setupEvents!;
  const announcements = events.filter(event => event.kind === 'announcement').slice(-4);
  render(<ReviewScreen record={record} onBack={() => {}} />);
  const live = document.querySelector('[aria-live="polite"]')!;
  expect(live.getAttribute('aria-atomic')).toBe('true');
  expect(within(live as HTMLElement).getByRole('heading').textContent).toBe('Announcements');
  expect(screen.getByRole('button', { name: 'Previous step', hidden: true }).hasAttribute('disabled')).toBe(true);
  expect(Array.from(live.querySelectorAll('p')).filter(p => /: \d+ points$/.test(p.textContent!)).map(p => p.textContent))
    .toEqual(announcements.map(event => `${text(`seat.${event.seat}`)}: ${event.hcp} points`));
  const ns = announcements.filter(event => event.seat === 'north' || event.seat === 'south').reduce((sum, event) => sum + event.hcp, 0);
  expect(live.textContent).toContain(`North–South: ${ns} · East–West: ${40 - ns}`);
  expect(live.textContent?.includes('The 20–20 Deal was redealt.')).toBe(scenario === 'redeal');
  const current = () => document.querySelectorAll('[aria-current="step"]');
  expect(current()).toHaveLength(1);
  expect(current()[0].textContent).toBe('Announcements');
  expect(document.querySelector('.review-strip')!.querySelectorAll('button')).toHaveLength(16);
  fireEvent.click(screen.getByRole('button', { name: 'Show all 4 hands' }));
  function expectDealtHands() {
    const hands = screen.getByRole('region', { name: 'Hands as dealt' });
    for (const seat of SEATS) {
      const hand = within(hands).getByRole('region', { name: text(`seat.${seat}`) });
      expect(within(hand).getAllByRole('img').map(card => card.getAttribute('aria-label'))).toEqual(record.deal.hands[seat].map(cardName));
    }
  }
  expectDealtHands();
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  const declarer = events.find(event => event.kind === 'declarer')!;
  const dummy = events.find(event => event.kind === 'dummy-exposed')!;
  expect(live.textContent).toContain('Declarer and dummy');
  expect(live.textContent).toContain(text(declarer.tied ? 'setup.tie' : 'setup.declarer', { seat: text(`seat.${declarer.seat}`) }));
  expect(live.textContent).toContain(text('setup.dummy', { seat: text(`seat.${dummy.seat}`) }));
  expectDealtHands();
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  expect(live.textContent).toContain('Contract Choice');
  expect(live.textContent).toContain(scenario === 'declaring' ? 'NT Game' : '♥ Game');
  expect(live.textContent).toContain(`${text(`seat.${declarer.seat}`)} declares · ${scenario === 'declaring' ? 9 : 10} tricks`);
  expectDealtHands();
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  expect(screen.getByRole('heading', { name: 'Trick 1 of 13' })).toBeTruthy();
  expect(live.textContent).toContain(text('review.winner', { seat: text(`seat.${replay(record)[0].winner}`) }));
  expect(current()).toHaveLength(1);
  expect(current()[0].getAttribute('aria-label')).toBe('Trick 1');
  expect(screen.getByRole('region', { name: 'Hands as trick 1 began' }).querySelectorAll('[role="img"]')).toHaveLength(52);
  expect(screen.queryByRole('button', { name: 'Previous trick' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
  expect(screen.getByRole('heading', { name: 'Contract Choice' })).toBeTruthy();
  fireEvent.click(within(document.querySelector('.review-strip') as HTMLElement).getByRole('button', { name: 'Announcements', hidden: true }));
  expect(screen.getByRole('heading', { name: 'Announcements' })).toBeTruthy();
});

test('US-16.2: setup offsets never shift trick-cost badges or trick buttons', () => {
  const record = miniBridgeRecord(deal => nsPoints(deal) > 20);
  const costs = [0, 3, 4, 51].map(positionIndex => ({ positionIndex, cost: positionIndex + 1, statement: {
    id: `cost-${positionIndex}`, playthroughId: record.playthroughId, positionIndex, kind: 'statement' as const,
    summary: 'test cost', text: `Cost at action ${positionIndex}`, informationMode: 'ALL_HANDS' as const,
    provenance: { sourceKind: 'template' as const, templateId: 'review.cost-description' }, at: new Date().toISOString(),
  } }));
  render(<ReviewScreen record={record} onBack={() => {}} analysis={{ running: false, costs }} />);
  const strip = within(document.querySelector('.review-strip') as HTMLElement);
  expect(document.querySelectorAll('.review-cost')).toHaveLength(0);
  for (const [trick, positions] of [[1, [0, 3]], [2, [4]], [13, [51]]] as const) {
    fireEvent.click(strip.getByRole('button', { name: `Trick ${trick}`, hidden: true }));
    expect(screen.getByRole('heading', { name: `Trick ${trick} of 13` })).toBeTruthy();
    expect(Array.from(document.querySelectorAll('.review-cost')).map(badge => badge.getAttribute('aria-label')))
      .toEqual(positions.map(position => `Cost at action ${position}`));
  }
  expect(screen.getByRole('button', { name: 'Next trick' }).hasAttribute('disabled')).toBe(true);
});


test('US-16.2: legacy Contract Bridge records without format or setup still open at trick 1', () => {
  const { gameFormat, setupEvents, ...legacy } = completeFixedDeal();
  expect(gameFormat).toBe('contract-bridge');
  expect(setupEvents ?? []).toEqual([]);
  render(<ReviewScreen record={completedRecord(legacy)} onBack={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Trick 1 of 13' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Announcements' })).toBeNull();
  expect(document.querySelector('.review-strip')!.querySelectorAll('button')).toHaveLength(13);
});
