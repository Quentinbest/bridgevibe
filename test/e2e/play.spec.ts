import { expect, test, type Page } from '@playwright/test';
import { cardName, text } from '../../src/explanation';
import { fixedDeal } from '../../src/app/fixture';
import { sameCard, type Card } from '../../src/table';
import { completeFixedDeal } from '../strategy';

async function open(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto('/');
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
  const reference = completeFixedDeal();
  expect(reference.result).toEqual({ northSouth: 6, eastWest: 7 });
  const played: Card[] = [];
  await open(page);
  await noHiddenCards(page, played);
  for (const entry of reference.actions) {
    if (entry.controller === 'robot') {
      await page.clock.runFor(500);
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
  await expect(page.getByText('You took 6 of 13 tricks (needed 9)', { exact: true })).toBeVisible();
  await expect(page.locator('.hand .card, .suit-column .card')).toHaveCount(0);
  await robotAuditPassed(page);
});
test('keyboard arrows, Enter, Escape and Space play from the active hand', async ({ page }) => {
  await open(page); await page.clock.runFor(500);
  const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
  const five = page.getByRole('button', { name: '5 of spades, playable', exact: true });
  await expect(ace).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(five).toBeFocused();
  await page.keyboard.press('Enter'); await expect(five).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape'); await expect(five).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /^Play it, / })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft'); await expect(ace).toBeFocused();
  await page.keyboard.press('Enter'); await expect(ace).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter'); await expect(ace).toHaveCount(0);
  await page.clock.runFor(500);
  const king = page.getByRole('button', { name: 'King of spades, playable', exact: true });
  await expect(king).toBeFocused();
  await page.keyboard.press('Space'); await expect(king).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space'); await expect(king).toHaveCount(0);
  await expect(page.locator('.trick-area .card')).toHaveCount(4);
});
test('off-suit card is rejected, retained and announced until the next action', async ({ page }) => {
  await open(page); await page.clock.runFor(500);
  const queen = page.getByRole('button', { name: "Queen of hearts, can't play: you must follow spades", exact: true });
  await queen.click(); await queen.click();
  await expect(queen).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[aria-live="assertive"]')).toHaveText('Play spades; you still have that suit.');
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  await page.clock.runFor(2000);
  await expect(page.locator('[aria-live="assertive"]')).toHaveText('Play spades; you still have that suit.');
  const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
  await ace.click(); await ace.click();
  await expect(page.locator('[aria-live="assertive"]')).toBeEmpty();
});
test('blind lead and later positions never expose unplayed opponent cards', async ({ page }) => {
  await open(page); await noHiddenCards(page, []);
  await expect(page.getByRole('img', { name: 'Ace of spades', exact: true })).toHaveCount(0);
  await page.clock.runFor(500);
  await noHiddenCards(page, [{ suit: 'spades', rank: '9' }]);
  const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
  await ace.click(); await page.getByRole('button', { name: /^Play it, / }).click();
  await page.clock.runFor(500);
  await noHiddenCards(page, [{ suit: 'spades', rank: '9' }, { suit: 'spades', rank: 'A' }, { suit: 'spades', rank: '3' }]);
  await robotAuditPassed(page);
});
