import { expect, test } from '@playwright/test';
import { openPractice, choosePractice } from './miniBridge';
// US-14: real workers, clocks and catalogue; the core and engines are not mocked.
test('practice hint is requested, bounded, unmarked and dismissible; toggle hides its control', async ({ page }) => {
  await openPractice(page, '/?debug=1'); await choosePractice(page);
  const hint = page.getByRole('button', { name: 'Hint', exact: true });
  await expect(hint).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hint', exact: true })).toHaveCount(0);
  const selected = await page.locator('.card[aria-pressed="true"]').count();
  await hint.click();
  const sheet = page.getByRole('region', { name: 'Hint', exact: true });
  await expect(sheet.getByText('No peeking: your view only', { exact: true })).toBeVisible();
  await expect(sheet.getByText('You choose the card', { exact: true })).toBeVisible();
  await expect(sheet.locator('[aria-busy="false"]')).toBeVisible({ timeout: 6000 });
  expect(await sheet.innerText()).not.toMatch(/%|percent|probab|\d+\.\d+/i);
  expect(await page.locator('.card[aria-pressed="true"]').count()).toBe(selected);
  const bounds = await sheet.boundingBox(); const viewport = page.viewportSize()!;
  if (viewport.width === 390) expect(bounds!.height).toBeLessThanOrEqual(844 * .4);
  if (viewport.width === 1440) expect(bounds!.x).toBeGreaterThan(viewport.width / 2);
  await expect(page.locator('.debug-panel li').filter({ hasText: 'bv-layout' })).toHaveCount(1);
  await sheet.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(hint).toBeFocused();
  await page.getByRole('checkbox', { name: 'Hints when I ask', exact: true }).uncheck();
  await expect(hint).toHaveCount(0);
});

// US-14.2, UX §3.1: enabling hints must not grow the phone's existing action row.
test('hint controls and Play it fit together without increasing the fixed Deal height', async ({ page }) => {
  await openPractice(page, '/'); await choosePractice(page);
  const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
  await ace.click();
  await page.evaluate(() => document.fonts.ready);
  const footer = await page.locator('.action-bar').boundingBox();
  expect(footer!.height).toBe(64);
  for (const control of [page.locator('.hint-toggle'), page.getByRole('button', { name: 'Hint', exact: true })]) {
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const viewport = page.viewportSize()!;
  if (viewport.width === 390) {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
  if (viewport.width === 1440) {
    const controls = await page.locator('.hint-controls').boundingBox();
    expect(controls!.x).toBeGreaterThan(viewport.width / 2);
  }
});

for (const fault of ['timeout', 'no-layout'] as const) {
  test(`US-45.1: hint ${fault} is shown and logged with zero silent fallbacks`, async ({ page }) => {
    await page.goto(`/?debug=1&hintFault=${fault}`); await choosePractice(page);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    const sheet = page.getByRole('region', { name: 'Hint', exact: true });
    const alert = sheet.getByRole('alert');
    await expect(alert).toHaveText(fault === 'timeout'
      ? "The hint helper didn't finish in time. You can keep playing."
      : "I can't tell from what you can see: too many hidden layouts fit, or none does.");
    const panel = page.getByTestId('provenance-debug-panel');
    const entry = panel.locator('li pre').filter({ hasText: fault === 'timeout' ? 'unavailable' : 'uncertain' });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(fault === 'timeout' ? 'timeout' : 'constraints');
    await expect(panel.locator('.debug-counters > div').filter({ hasText: 'Silent fallbacks' }).locator('dd')).toHaveText('0');
    expect(await sheet.innerText()).not.toMatch(/samples|rule of thumb|best card/i);
    await sheet.getByRole('button', { name: 'Got it', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeFocused();
  });
}
