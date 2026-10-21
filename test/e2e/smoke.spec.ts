import { choosePractice } from './miniBridge';
import { expect, test } from '@playwright/test';

// The other specs install Playwright's fake clock, which replaces the browser's timer functions;
// this one runs on real timers, so a crash that only real timers trigger fails here.
test('the app loads on real timers and a robot plays through the worker', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await choosePractice(page, false);
  await expect(page.locator('.learner .card')).toHaveCount(13);
  // US-10.4: West's opening lead arrives from the worker after the display delay.
  await expect(page.locator('.trick-area .card')).toHaveCount(1, { timeout: 5000 });
  expect(errors).toEqual([]);
});
