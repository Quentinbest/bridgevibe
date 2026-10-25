import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { cardName } from '../../src/explanation';
import { f4Position, finish, points } from '../f4/records';
import { installPausedClock, robotTurn } from './miniBridge';

// US-18.9, VAL-07: enter via the reproducible practice URL and play the real labelled line.
test('F4 practice review shows a labelled big moment with hindsight and keyboard navigation', async ({ page }) => {
  const point = points[1];
  const record = finish(f4Position(point), point.candidates[3].cards[0]);
  await installPausedClock(page);
  await page.goto('/?seed=bv-f4-draft&deal=2');
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: 'spades', exact: true }).click();
  await page.getByRole('button', { name: 'Part-score · 7 tricks', exact: true }).click();
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
  for (const entry of record.actions) {
    if (entry.controller === 'robot') await robotTurn(page);
    else {
      await page.getByRole('button', { name: `${cardName(entry.action.card)}, playable`, exact: true }).click();
      await page.getByRole('button', { name: `Play it, ${cardName(entry.action.card)}`, exact: true }).click();
    }
    if (entry.index % 4 === 3) await page.clock.runFor(1000);
  }
  await page.getByRole('button', { name: 'Review this deal', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.clock.resume();
  await expect(page.getByRole('heading', { name: /^[1-3] big moments?$/ })).toBeVisible();
  const moment = page.locator('.key-moment').filter({ hasText: 'Trick 2 · you played 8 of hearts' });
  await expect(moment).toContainText('Trick 2 · you played 8 of hearts');
  await expect(moment).toContainText('Better option');
  await expect(moment).toContainText('X-ray view: with all cards visible');
  await expect(moment.locator('.moment-badge [aria-hidden="true"]')).toHaveText('↻');
  if (page.viewportSize()!.width >= 1000) {
    const marked = page.getByRole('button', { name: 'Trick 2, big moment', exact: true });
    await marked.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Trick 2 of 13' })).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
