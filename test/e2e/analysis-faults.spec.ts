import { choosePractice } from './miniBridge';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { completeFixedDeal } from '../strategy';
import { cardName } from '../../src/explanation';

for (const fault of ['timeout', 'error', 'crash', 'protocol-mismatch', 'success']) {
  test(`VAL-06: ${fault}, replay, provenance and keyboard recovery`, async ({ page }) => {
    // #55: one fixed time for both calls; a later Node clock can't be in the page clock's past.
    const time = new Date(); await page.clock.install({ time }); await page.clock.pauseAt(time);
    await page.goto(`/?debug=1&analysisFault=${fault}`); await choosePractice(page, true);
    for (const entry of completeFixedDeal().actions) {
      if (entry.controller === 'robot') await page.clock.runFor(500);
      else {
        await page.getByRole('button', { name: `${cardName(entry.action.card)}, playable`, exact: true }).click();
        await page.getByRole('button', { name: `Play it, ${cardName(entry.action.card)}`, exact: true }).click();
      }
      if (entry.index % 4 === 3) await page.clock.runFor(1000);
    }
    await page.clock.resume();
    await page.getByRole('button', { name: 'Hand review', exact: true }).click();
    // US-16.2: setup precedes tricks; retain the analysis checks at trick 1.
    for (let step = 0; step < 3; step++) await page.getByRole('button', { name: 'Next step', exact: true }).click();
    const panel = page.getByTestId('provenance-debug-panel');
    const counter = panel.locator('.debug-counters > div').filter({ hasText: 'Silent fallbacks' }).locator('dd');
    if (fault !== 'success') {
      await expect(page.getByRole('status')).toHaveText("X-ray view isn't available right now");
      await expect(panel.locator('pre').filter({ hasText: 'unavailable' })).toContainText(fault === 'crash' ? 'worker-crash' : fault);
      await expect(page.locator('.review-cost')).toHaveCount(0);
      await expect(counter).toHaveText('0');
      await page.getByRole('button', { name: 'Next trick' }).click();
      await expect(page.getByText('Trick 2 of 13', { exact: true })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      // US-45.1: removing the audit fault allows the fresh worker to succeed.
      await page.evaluate(() => history.replaceState(null, '', '/?debug=1'));
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/assets/analysisWorker-*.js', async route => { await gate; await route.continue(); });
      await page.getByRole('button', { name: 'Try again' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Hand review' })).toBeFocused();
      await expect(page.getByRole('status')).toHaveText('Working out the X-ray view…');
      release();
      await page.getByRole('button', { name: 'Previous trick' }).click();
    }
    await expect(page.locator('.review-cost')).toHaveCount(2);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(counter).toHaveText('0');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
