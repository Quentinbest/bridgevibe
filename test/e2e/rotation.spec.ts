import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { dealFromSeed, startMiniBridge, type Seat } from '../../src/table';
import { choosePractice, installPausedClock, robotTurn } from './miniBridge';

// US-02: find reproducible fixtures through the Table, never HCP assumptions in the UI test.
function fixture(declarer: Seat) {
  const defending = declarer === 'east' || declarer === 'west';
  for (let index = 1; index < 100; index++) {
    const setup = startMiniBridge({ deal: dealFromSeed('table-turns', index), learnerSide: 'northSouth' });
    for (let i = 0; i < 4; i++) setup.advance();
    if (setup.seatView('south').declarer === declarer && (index > 1 || !defending)) {
      return `/?seed=table-turns&deal=${defending ? index - 1 : index}`;
    }
  }
  throw new Error('Missing fixture');
}
for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`North declares: keyboard, notice, compass and ${reducedMotion}`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion });
  await installPausedClock(page);
  await page.goto(fixture('north'));
  await page.clock.runFor(3000);
  await expect(page.locator('.table')).toHaveCount(0);
  const setupSouth = page.locator('.setup-own');
  await expect(setupSouth).toHaveAccessibleName('South');
  await expect(setupSouth).toHaveAttribute('data-position', 'bottom');
  await expect(setupSouth).toContainText('S · South · You');
  expect((await setupSouth.boundingBox())!.y).toBeGreaterThan((await page.locator('.setup-north').boundingBox())!.y);
  await expect(page.locator('.rotation-notice')).toHaveCount(0);
  await choosePractice(page);
  const notice = page.locator('.rotation-notice');
  await expect(notice.getByRole('status')).toHaveText("North won the contract, so you play North's cards as declarer. Your own hand becomes dummy. We've turned the table so the hand you play from is at the bottom.");
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const gotIt = page.getByRole('button', { name: 'Got it' });
  await gotIt.focus();
  await robotTurn(page);
  await expect(gotIt).toBeFocused();
  await expect(page.locator('.turn-banner')).toHaveText('Play from South (dummy)');
  const openingLead = page.locator('.played-left');
  await expect(openingLead).toHaveAttribute('data-seat', 'east');
  await expect(openingLead.locator('.led')).toHaveText('LED');
  const leadBox = (await openingLead.boundingBox())!;
  const trickBox = (await page.locator('.trick-area').boundingBox())!;
  expect(leadBox.x + leadBox.width / 2).toBeLessThan(trickBox.x + trickBox.width / 2);
  await gotIt.press('Enter');
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.turn-banner')).toBeFocused();
  const north = page.locator('.table > [data-seat="north"]');
  const south = page.locator('.table > [data-seat="south"]');
  await expect(north).toHaveAttribute('data-position', 'bottom');
  await expect(south).toHaveAttribute('data-position', 'top');
  await expect(north.locator('.seat-label')).toHaveText('N · North · You play');
  await expect(south.locator('.seat-label')).toHaveText('S · South · You play');
  expect((await north.boundingBox())!.y).toBeGreaterThan((await south.boundingBox())!.y);
  expect((await page.locator('.east').boundingBox())!.x).toBeLessThan((await page.locator('.west').boundingBox())!.x);
  if (reducedMotion === 'reduce') expect(await north.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  else expect(await north.evaluate(el => getComputedStyle(el).animationName)).toBe('turn-from-top');
  const dummyCard = south.getByRole('button', { name: /, playable$/ }).first();
  await dummyCard.focus(); await dummyCard.press('ArrowRight');
  await dummyCard.focus(); await dummyCard.press('Enter'); await dummyCard.press('Enter');
  await robotTurn(page);
  await expect(page.locator('.turn-banner')).toHaveText('Play from North (declarer)');
  await expect(page.locator('.played-top')).toHaveAttribute('data-seat', 'south');
  await expect(page.locator('.played-right')).toHaveAttribute('data-seat', 'west');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (testInfo.project.use.viewport!.width === 390) {
    const lines = await page.locator('.status > span').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().y));
    expect(Math.max(...lines) - Math.min(...lines)).toBeLessThan(12);
  }
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const declarerCard = north.getByRole('button', { name: /, playable$/ }).first();
  await declarerCard.focus(); await declarerCard.press('Space'); await declarerCard.press('Space');
  await expect(page.locator('.played-bottom')).toHaveAttribute('data-seat', 'north');
});

for (const declarer of ['south', 'east', 'west'] as const) test(`${declarer} declaring keeps South at bottom`, async ({ page }) => {
  await installPausedClock(page);
  await page.goto(fixture(declarer));
  if (declarer === 'east' || declarer === 'west') await page.getByRole('button', { name: 'New deal', exact: true }).click();
  if (declarer === 'south') await choosePractice(page, true);
  else await page.clock.runFor(3500);
  await expect(page.locator('.table > [data-seat="south"]')).toHaveAttribute('data-position', 'bottom');
  await expect(page.locator('.table > [data-seat="north"]')).toHaveAttribute('data-position', 'top');
  await expect(page.locator('.east')).toHaveAttribute('data-position', 'right');
  await expect(page.locator('.west')).toHaveAttribute('data-position', 'left');
  expect((await page.locator('.table > [data-seat="south"]').boundingBox())!.y)
    .toBeGreaterThan((await page.locator('.table > [data-seat="north"]').boundingBox())!.y);
  expect((await page.locator('.east').boundingBox())!.x).toBeGreaterThan((await page.locator('.west').boundingBox())!.x);
  await expect(page.getByRole('button', { name: 'Got it' })).toHaveCount(0);
});
