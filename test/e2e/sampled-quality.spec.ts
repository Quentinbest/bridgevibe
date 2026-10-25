import { test, expect } from '@playwright/test';
import { sampledPractice } from '../sampledPractice';
import { cardName } from '../../src/explanation';
import { installPausedClock, robotTurn } from './miniBridge';

test('US-18: unlabelled seeded practice reviews sampled quality or explicitly uncertain quality', async ({ page }) => {
  // Composition test proves this exact seed/line contains at least one costly decision.
  const record = sampledPractice();
  await installPausedClock(page);
  await page.goto('/?seed=bv-issue-27&deal=1');
  await page.clock.runFor(3000);
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
  await page.getByRole('button', { name: 'Review this deal', exact: true }).click();
  await page.clock.resume();
  await expect(page.getByText('Working out the X-ray view…', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Checking your choices against the cards you could see…', { exact: true })).toHaveCount(0);
  if (await page.locator('.key-moment').count()) {
    await expect(page.locator('.key-moment .moment-quality').first()).toContainText('based on sampled layouts');
  } else {
    for (let n = 0; n < 3; n++) await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(page.locator('.review-quality').first()).toContainText('uncertain');
    await expect(page.locator('.moment-mistake, .moment-lucky')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.__robotAuditViolations)).toEqual([]);
});
