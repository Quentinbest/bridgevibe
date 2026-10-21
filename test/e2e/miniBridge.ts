import { expect, type Page } from '@playwright/test';

// US-06: the authored default has South declaring; choose NT game to preserve play scenarios.
export async function choosePractice(page: Page, clock = false) {
  if (clock) await page.clock.runFor(3000);
  await expect(page.getByRole('button', { name: 'Choose', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Game · 9 tricks', exact: true }).click();
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
}

// #55: one fixed time for install and pauseAt; a later Node clock can't be in the page clock's past.
export async function installPausedClock(page: Page) {
  const time = new Date(); await page.clock.install({ time }); await page.clock.pauseAt(time);
}
