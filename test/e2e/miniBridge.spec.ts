import { openPractice, installPausedClock, robotTurn } from './miniBridge';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('US-06: ordered announcements, exposed dummy, keyboard strain/objective choice and opening lead', async ({ page }) => {
  await installPausedClock(page); await openPractice(page, '/');
  await expect(page.locator('.setup-points li')).toHaveCount(0);
  for (const [i, label] of ['South: 17 points', 'West: 8 points', 'North: 15 points', 'East: 0 points'].entries()) {
    await robotTurn(page); await expect(page.locator('.setup-points li').nth(i)).toHaveText(label);
  }
  await expect(page.getByText('North–South: 32 · East–West: 8')).toBeVisible();
  await robotTurn(page); await expect(page.locator('.setup-dummy .card')).toHaveCount(13);
  await expect(page.getByRole('button', { name: 'Choose', exact: true })).toHaveCount(0);
  await robotTurn(page);
  const spades = page.getByRole('button', { name: 'spades', exact: true });
  await expect(spades).toBeFocused(); await page.keyboard.press('Enter'); await expect(spades).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Game · 10 tricks' })).toBeVisible();
  await page.getByRole('button', { name: 'Game · 10 tricks' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.clock.resume(); expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Choose', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('South declares · 10 tricks', { exact: true })).toBeVisible();
  await expect(page.locator('.contract')).toHaveText('♠ Game');
  await expect(page.locator('.played-west .card')).toHaveCount(1);
  await expect(page.locator('.dummy button[tabindex="0"]')).toBeFocused();
});
test('UX §4.2: reduced motion preserves announcement order and reveals the choice', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await openPractice(page, '/');
  await expect(page.getByRole('button', { name: 'Choose', exact: true })).toBeVisible();
  await expect(page.locator('.setup-points li')).toHaveText(['South: 17 points', 'West: 8 points', 'North: 15 points', 'East: 0 points']);
});
test('US-06.2: redeal message lasts 1500 ms and deal metadata advances', async ({ page }) => {
  await installPausedClock(page); await page.goto('/?seed=setup-ui&deal=1');
  await page.clock.runFor(2000); await expect(page.getByText("It's 20–20 — nobody gets to declare. Dealing again.")).toBeVisible();
  await page.clock.runFor(1499); await expect(page.locator('.setup-points li')).toHaveCount(4);
  await page.clock.runFor(1); await expect(page.locator('.setup-points li')).toHaveCount(0);
  await page.getByRole('button', { name: 'Deal info', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('2');
});
for (const [index, dummy] of [[2, 'east'], [3, 'west']] as const) test(`robot contract exposes ${dummy} in its own place`, async ({ page }) => {
  await installPausedClock(page);
  await page.goto(`/?seed=setup-ui&deal=${index - 1}`);
  await page.getByRole('button', { name: 'New deal', exact: true }).click();
  await page.clock.runFor(3500);
  await expect(page.locator(`.opponent.${dummy} .card`)).toHaveCount(13, { timeout: 10000 });
  await expect(page.locator('.dummy .card')).toHaveCount(0);
  await expect(page.locator('.contract')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => window.__robotAuditViolations ?? [])).toEqual([]);
});
test('ADR-0003: North declares and both North and South have learner turns', async ({ page }) => {
  await installPausedClock(page); await page.goto('/?seed=setup-ui&deal=6');
  await page.clock.runFor(3000); await expect(page.locator('.setup-own')).toHaveAccessibleName('South');
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
  await robotTurn(page);
  const south = page.locator('.learner button.card').filter({ hasText: /, playable$/ }).first();
  await south.click(); await page.getByRole('button', { name: /^Play it,/ }).click();
  await robotTurn(page);
  await expect(page.locator('.dummy button.card')).toHaveCount(13);
  await expect(page.locator('.dummy')).toHaveAccessibleName('North');
});
