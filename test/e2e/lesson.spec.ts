import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openPrompt(page: import('@playwright/test').Page) {
  await page.clock.install();
  await page.goto('/?lesson=follow-suit');
  await expect(page.getByText('1/5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.clock.runFor(1000);
  await expect(page.getByText('3/5', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 3 of 5');
}
test('lesson accepts alternatives, keeps progress synchronized, and closes to practice', async ({ page }) => {
  await openPrompt(page);
  const card = page.getByRole('button', { name: 'King of hearts', exact: true });
  await card.click();
  await page.getByRole('button', { name: 'Play it, King of hearts', exact: true }).click();
  await expect(page.getByText('Nice. You followed suit. Any of these works: Ace of hearts, King of hearts, Queen of hearts.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step' })).toBeFocused();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByText('4/5', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  await page.clock.runFor(500);
  await expect(page.getByText('5/5', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
  await page.getByRole('button', { name: 'Close lesson', exact: true }).click();
  await expect(page).not.toHaveURL(/lesson=/);
  await expect(page.getByRole('heading', { name: 'BridgeVibe' })).toBeVisible();
});
test('wrong twice, rules feedback, hint provenance, Show me and script continuation', async ({ page }) => {
  await openPrompt(page);
  const wrong = page.locator('.hand button[data-suit="spades"]').first();
  for (let i = 0; i < 2; i++) { await wrong.click(); await page.getByRole('button', { name: /^Play it,/ }).click(); }
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveText('Not that one. You still have hearts.');
  await page.getByRole('button', { name: 'Why is that the rule?' }).click();
  await expect(page.getByText(/The first card of a trick sets the suit/)).toBeVisible();
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.getByText('Authored hint · follow-suit.prompt · version 1')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.getByText(/These answers follow suit: Ace of hearts, King of hearts, Queen of hearts/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step' })).toBeFocused();
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.clock.runFor(500);
  await expect(page.getByText('5/5', { exact: true })).toBeVisible();
});
test('keyboard, draft label, no answer clues, responsive layout and axe in each theme', async ({ page }) => {
  await openPrompt(page);
  await expect(page.getByText('Unsigned draft content')).toBeVisible();
  await expect(page.getByRole('button', { name: /playable|can't play/ })).toHaveCount(0);
  await page.keyboard.press('h');
  await expect(page.getByText('Authored hint · follow-suit.prompt · version 1')).toBeVisible();
  const card = page.getByRole('button', { name: 'Ace of hearts', exact: true });
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'King of hearts', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Play it,/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Nice. You followed suit/)).toBeVisible();
});
