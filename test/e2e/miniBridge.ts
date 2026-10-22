import { expect, type Page } from '@playwright/test';

// US-06: the authored default has South declaring; choose NT game to preserve play scenarios.
export async function choosePractice(page: Page, clock = false) {
  if (clock) await page.clock.runFor(3000);
  await expect(page.getByRole('button', { name: 'Choose', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Game · 9 tricks', exact: true }).click();
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
}

// #36: install at a fixed time and pause a second later, so the pause target is always ahead of the
// page clock however slowly the machine runs; the only place e2e specs may call pauseAt.
export async function installPausedClock(page: Page) {
  const time = Date.now(); await page.clock.install({ time }); await page.clock.pauseAt(time + 1000);
}

// UX §2.3: preserve query context (debug/fault injection) while entering practice from Home.
export async function openPractice(page: Page, url = '/') {
  await page.goto(url);
  await page.getByRole('link', { name: /^Quick game/ }).click();
}
