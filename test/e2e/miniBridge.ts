import { expect, type Page } from '@playwright/test';
import { text } from '../../src/explanation';
import { REVIEW_DEADLINE_MS } from '../../src/information/parameters';

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

// #13: let the robot worker answer in real time before paused time passes its 400 ms deadline.
export async function robotTurn(page: Page, ms = 500) {
  await expect.poll(() => page.evaluate(() => !window.__robotPending?.())).toBe(true);
  await page.clock.runFor(ms);
}

// UX §2.3: preserve query context (debug/fault injection) while entering practice from Home.
export async function openPractice(page: Page, url = '/') {
  await page.goto(url);
  await page.getByRole('link', { name: /^Quick deal/ }).click();
}

// #110: call once the X-ray costs are shown. Review sampling starts in that same render, shows its status
// and runs for up to REVIEW_DEADLINE_MS of visible time; on a busy machine it outlasts the default expect
// timeout. Wait for it before asserting anything sampling can change: key moments, step labels, status.
export async function samplingSettled(page: Page) {
  await expect(page.getByText(text('review.sampling'), { exact: true })).toHaveCount(0, { timeout: REVIEW_DEADLINE_MS + 10_000 });
}
