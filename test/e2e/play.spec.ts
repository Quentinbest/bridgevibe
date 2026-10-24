import { openPractice, choosePractice, installPausedClock, robotTurn } from './miniBridge';
import { expect, test, type Page } from '@playwright/test';
import { cardName, text } from '../../src/explanation';
import { fixedDeal } from '../../src/app/fixture';
import { sameCard, type Card } from '../../src/table';
import { completeFixedDeal } from '../strategy';

async function open(page: Page) {
  await installPausedClock(page);
  await openPractice(page, '/'); await choosePractice(page, true);
}
// US-10.2: assert real-worker audit coverage, not just absence of visible leaks.
async function robotAuditPassed(page: Page) {
  const audit = await page.evaluate(() => ({ count: window.__robotAuditCount, violations: window.__robotAuditViolations }));
  expect(audit.count).toBeGreaterThan(0);
  expect(audit.violations).toEqual([]);
}
async function noHiddenCards(page: Page, played: readonly Card[]) {
  const pageText = await page.locator('body').textContent();
  const names = await page.locator('[aria-label]').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')).join('\n'));
  const accessibility = await page.locator('body').ariaSnapshot();
  for (const card of [...fixedDeal.hands.west, ...fixedDeal.hands.east]) {
    if (played.some(known => sameCard(known, card))) continue;
    expect(pageText).not.toContain(cardName(card));
    expect(pageText).not.toContain(`${card.rank}${text(`symbol.${card.suit}`)}`);
    expect(names).not.toContain(cardName(card));
    expect(accessibility).not.toContain(cardName(card));
  }
}
test('full fixed Deal through clicks and Play it', async ({ page }, testInfo) => {
  // Issue #2: the long journey runs only on these two representative projects.
  test.skip(!['390-light', '1440-dark'].includes(testInfo.project.name), 'Full Deal project coverage specified by issue #2');
  const reference = completeFixedDeal('principles');
  expect(reference.result).toEqual({ northSouth: 5, eastWest: 8 });
  const played: Card[] = [];
  await open(page);
  await noHiddenCards(page, played);
  for (const entry of reference.actions) {
    if (entry.controller === 'robot') {
      await robotTurn(page);
    } else {
      const region = page.getByRole('region', { name: entry.seat === 'north' ? 'North · Dummy' : 'Your hand', exact: true });
      const card = region.getByRole('button', { name: `${cardName(entry.action.card)}, playable`, exact: true });
      await expect(region.locator('button[tabindex="0"]')).toBeFocused();
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      // UX §3.3: the confirmation names the card it plays.
      await page.getByRole('button', { name: `Play it, ${cardName(entry.action.card)}`, exact: true }).click();
    }
    played.push(entry.action.card);
    await expect(page.getByRole('log')).toContainText(`${text(`seat.${entry.seat}`)} plays the ${cardName(entry.action.card)}`);
    if (entry.index % 4 === 3) {
      await expect(page.locator('.trick-area .card')).toHaveCount(4);
      await expect(page.locator('.led')).toHaveText('LED');
      await page.clock.runFor(999);
      await expect(page.locator('.trick-area .card')).toHaveCount(4);
      await page.clock.runFor(1);
      await expect(page.locator('.trick-area .card')).toHaveCount(0);
    }
    if ([0, 9, 25, 47].includes(entry.index)) await noHiddenCards(page, played);
  }
  await expect(page.getByText('You took 5 of 13 tricks (needed 9)', { exact: true })).toBeVisible();
  await expect(page.locator('.hand .card, .suit-column .card')).toHaveCount(0);
  await robotAuditPassed(page);
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.getByText(/1 deal played this session/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await page.reload();
  await expect(page.getByText(/0 deals played this session/)).toBeVisible();
});
test('keyboard arrows, Enter, Escape and Space play from the active hand', async ({ page }) => {
  await open(page); await robotTurn(page);
  const queen = page.getByRole('button', { name: 'Queen of hearts, playable', exact: true });
  const four = page.getByRole('button', { name: '4 of hearts, playable', exact: true });
  // UX §10: focus enters at the first card; arrows cross the spades North can't play to the hearts.
  await expect(page.getByRole('button', { name: "Ace of spades, can't play: you must follow hearts", exact: true })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(queen).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(four).toBeFocused();
  await page.keyboard.press('Enter'); await expect(four).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape'); await expect(four).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /^Play it, / })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft'); await expect(queen).toBeFocused();
  await page.keyboard.press('Enter'); await expect(queen).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter'); await expect(queen).toHaveCount(0);
  await robotTurn(page);
  const ace = page.getByRole('button', { name: 'Ace of hearts, playable', exact: true });
  await expect(page.getByRole('button', { name: "King of spades, can't play: you must follow hearts", exact: true })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(ace).toBeFocused();
  await page.keyboard.press('Space'); await expect(ace).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space'); await expect(ace).toHaveCount(0);
  await expect(page.locator('.trick-area .card')).toHaveCount(4);
});
test('off-suit card is rejected, retained and announced until the next action', async ({ page }) => {
  await open(page); await robotTurn(page);
  const spade = page.getByRole('button', { name: "Ace of spades, can't play: you must follow hearts", exact: true });
  await spade.click(); await spade.click();
  await expect(spade).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[aria-live="assertive"]')).toHaveText('Not that one. You still have hearts.');
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(page.locator('[aria-live="assertive"]')).toHaveText('Not that one. You still have hearts.');
  const queen = page.getByRole('button', { name: 'Queen of hearts, playable', exact: true });
  await queen.click(); await queen.click();
  await expect(page.locator('[aria-live="assertive"]')).toBeEmpty();
});
test('MiniBridge exposes dummy before the lead and never exposes unplayed opponent cards', async ({ page }) => {
  await open(page); await noHiddenCards(page, []);
  await expect(page.getByRole('img', { name: 'Ace of spades', exact: true })).toBeVisible();
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  await robotTurn(page);
  await noHiddenCards(page, [{ suit: 'hearts', rank: 'J' }]);
  const queen = page.getByRole('button', { name: 'Queen of hearts, playable', exact: true });
  await queen.click(); await page.getByRole('button', { name: /^Play it, / }).click();
  await robotTurn(page);
  await noHiddenCards(page, [{ suit: 'hearts', rank: 'J' }, { suit: 'hearts', rank: '8' }]);
  await robotAuditPassed(page);
});
