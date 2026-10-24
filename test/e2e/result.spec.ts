import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { completeFixedDeal } from '../strategy';
import { cardName } from '../../src/explanation';
import { choosePractice, installPausedClock, openPractice, robotTurn } from './miniBridge';

test('US-09: complete MiniBridge, inspect score, review the same result and start next deal', async ({ page }) => {
  await installPausedClock(page); await openPractice(page); await choosePractice(page, true);
  for (const entry of completeFixedDeal('principles').actions) {
    if (entry.controller === 'robot') await robotTurn(page);
    else {
      await page.getByRole('button', { name: `${cardName(entry.action.card)}, playable`, exact: true }).click();
      await page.getByRole('button', { name: `Play it, ${cardName(entry.action.card)}`, exact: true }).click();
    }
    if (entry.index % 4 === 3) await page.clock.runFor(1000);
  }
  const result = page.getByRole('region', { name: 'MiniBridge result' });
  await expect(result).toBeVisible();
  const headline = await result.getByRole('heading').innerText();
  const contract = await result.locator('.result-contract').innerText();
  const score = await result.locator('.result-score').innerText();
  await expect(result.getByRole('button', { name: 'Next deal' })).not.toBeFocused();
  const breakdown = result.locator('summary');
  await breakdown.focus(); await page.keyboard.press('Enter');
  await expect(breakdown).toHaveAttribute('aria-expanded', 'true');
  await expect(result.getByRole('listitem')).toContainText('Tricks short of the goal: 4 × 50 subtracts 200');
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await result.getByRole('button', { name: 'Review this deal' }).click();
  await expect(result.getByRole('heading')).toHaveText(headline);
  await expect(result.locator('.result-contract')).toHaveText(contract);
  await expect(result.locator('.result-score')).toHaveText(score);
  await result.getByText('How scoring works', { exact: true }).click();
  await expect(result.getByText(/^EBU Laws/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to table' }).click();
  await expect(result.getByRole('button', { name: 'Next deal' })).not.toBeFocused();
  await result.getByRole('button', { name: 'Next deal' }).click();
  await expect(result).toHaveCount(0);
});
