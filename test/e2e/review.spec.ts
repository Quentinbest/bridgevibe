import { openPractice, choosePractice, installPausedClock } from './miniBridge';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { completeFixedDeal } from '../strategy';
import { cardName } from '../../src/explanation';
import { importPbn, importRecordJson, replay, completedRecord, sameCard, type Card } from '../../src/table';
import { fixedDeal } from '../../src/app/fixture';

// US-16.4: check identities in DOM attributes as well as the accessibility tree during play.
async function noHiddenCards(page: Page, played: readonly Card[]) {
  const dom = await page.locator('body').innerHTML();
  const accessibility = await page.locator('body').ariaSnapshot();
  const hidden = [...fixedDeal.hands.east, ...fixedDeal.hands.west]
    .filter(card => !played.some(known => sameCard(card, known)));
  for (const card of hidden) {
    expect(dom).not.toContain(cardName(card));
    expect(accessibility).not.toContain(cardName(card));
    expect(await page.locator(`[data-suit="${card.suit}"][data-rank="${card.rank}"]`).count()).toBe(0);
  }
  await expect(page.getByRole('button', { name: 'Review this deal', exact: true })).toHaveCount(0);
  await expect(page.getByRole('note')).toHaveCount(0);
}

test('US-04, US-16: review, keyboard stepper, four hands and record downloads', async ({ page }) => {
  const reference = completeFixedDeal();
  let solverRequested = false;
  let releaseSolver!: () => void;
  const solverGate = new Promise<void>(resolve => { releaseSolver = resolve; });
  await page.route('**/assets/analysisClient-*.js', async route => {
    solverRequested = true; await solverGate; await route.continue();
  });
  await installPausedClock(page); await openPractice(page, '/'); await choosePractice(page, true);
  const played: Card[] = [];
  await noHiddenCards(page, played);
  await expect(page.getByRole('img', { name: 'Ace of spades', exact: true })).toBeVisible();
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  expect(solverRequested).toBe(false);
  for (const entry of reference.actions) {
    if (entry.controller === 'robot') await page.clock.runFor(500);
    else {
      const card = page.getByRole('button', { name: `${cardName(entry.action.card)}, playable`, exact: true });
      await card.click(); await page.getByRole('button', { name: `Play it, ${cardName(entry.action.card)}`, exact: true }).click();
    }
    played.push(entry.action.card);
    if (entry.index % 4 === 3) await page.clock.runFor(1000);
    if ([0, 9, 25, 47].includes(entry.index)) { await noHiddenCards(page, played); expect(solverRequested).toBe(false); }
  }
  await expect.poll(() => solverRequested).toBe(true);
  const entry = page.getByRole('button', { name: 'Review this deal', exact: true });
  await entry.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Hand review' })).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Working out the X-ray view…');
  releaseSolver();
  await expect(page.getByRole('heading', { name: 'Announcements', exact: true })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText('Announcements');
  await expect(page.locator('.review-cost')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled();
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const setupNext = page.getByRole('button', { name: 'Next step', exact: true });
  // US-09.4: the result disclosures precede the replay stepper in keyboard order.
  await page.keyboard.press('Tab');
  await expect(page.getByText('How the score was worked out', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByText('How scoring works', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(setupNext).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Declarer and dummy' })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText('Declarer and dummy');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Contract Choice', exact: true })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText('Contract Choice');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Trick 1 of 13', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', 'Trick 1');
  await expect(page.locator('.review-cost')).toHaveCount(2);
  for (const badge of await page.locator('.review-cost').all()) {
    await expect(badge).toContainText('X-ray view: with all cards visible');
    await expect(badge).toHaveAccessibleName(/Engine: bridge-dds, version 1.4.0 \/ DDS 2.9/);
  }
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole('note')).toContainText('X-ray view: now you can see all 4 hands');
  // US-16.2: from trick 1, Previous leads back to the Contract Choice step.
  await expect(page.getByRole('button', { name: 'Previous step', exact: true })).toBeEnabled();
  const toggle = page.getByRole('button', { name: /^(Show|Hide) all 4 hands$/ });
  if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
  await expect(page.locator('#review-hands')).toHaveCount(0);
  await expect(toggle).toHaveText('Show all 4 hands');
  await expect(toggle).toHaveAccessibleName('Show all 4 hands');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(toggle).toHaveText('Hide all 4 hands');
  await expect(toggle).toHaveAccessibleName('Hide all 4 hands');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Hands as trick 1 began' })).toBeVisible();
  const next = page.getByRole('button', { name: 'Next trick' });
  await next.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Trick 2 of 13', { exact: true })).toBeVisible();
  const tricks = replay(completedRecord(reference));
  for (let n = 1; n < 13; n++) {
    await expect(page.getByText('Trick ' + (n + 1) + ' of 13', { exact: true })).toBeVisible();
    const winner = tricks[n].winner;
    await expect(page.getByText(winner[0].toUpperCase() + winner.slice(1) + ' won it', { exact: true })).toBeVisible();
    if (n < 12) await page.keyboard.press('Enter');
  }
  await expect(next).toBeDisabled();
  const previous = page.getByRole('button', { name: 'Previous trick' });
  await previous.focus(); await page.keyboard.press('Space');
  await expect(page.getByText('Trick 12 of 13', { exact: true })).toBeVisible();
  if (page.viewportSize()!.width >= 1000) {
    await expect(page.getByRole('navigation', { name: 'Replay steps' }).getByRole('button')).toHaveCount(16);
    await page.getByRole('button', { name: 'Trick 1', exact: true }).click();
    await expect(page.getByText('Trick 1 of 13', { exact: true })).toBeVisible();
  }
  for (const format of ['JSON', 'PBN']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export ' + format }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('bridgevibe.' + format.toLowerCase());
    const contents = await readFile((await file.path())!, 'utf8');
    const imported = format === 'JSON' ? completedRecord(importRecordJson(contents)) : importPbn(contents);
    expect(replay(imported)).toEqual(tricks);
    if (format === 'JSON') expect(imported.actions.every(entry => entry.provenance?.kind === entry.controller)).toBe(true);
  }
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Show all 4 hands');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Back to table' }).click();
  await expect(page.getByRole('button', { name: 'Review this deal', exact: true })).toBeVisible();
});

// §4.7: the first lesson never fetches the analysis host's dynamic client or worker.
test('first lesson loads without requesting the solver', async ({ page }) => {
  const solverRequests: string[] = [];
  page.on('request', request => { if (/analysisClient|analysisWorker|bridge-dds|\.wasm/.test(request.url())) solverRequests.push(request.url()); });
  await page.goto('/?lesson=follow-suit');
  await expect(page.getByRole('heading', { name: 'Follow suit' })).toBeVisible();
  // The lesson's first step is commentary; its Next step button shows the lesson has rendered.
  await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible();
  expect(solverRequests).toEqual([]);
});
