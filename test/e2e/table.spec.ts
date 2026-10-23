import { openPractice, choosePractice, installPausedClock } from './miniBridge';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('table is accessible, responsive and follows the device theme', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await installPausedClock(page);
  await openPractice(page, '/'); await choosePractice(page, true);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { level: 1, name: 'BridgeVibe' })).toHaveCount(1);
  await expect(page.getByText('West is playing', { exact: true })).toBeVisible();
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  await expect(page.getByText('NT Game', { exact: true })).toBeVisible();
  await expect(page.getByText('South declares · 9 tricks', { exact: true })).toBeVisible();
  await expect(page.getByText('You 0 · Them 0', { exact: true })).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.getByText('Play from North (dummy)', { exact: true })).toBeVisible();
  await expect(page.locator('.dummy .card')).toHaveCount(13);
  await expect(page.locator('.hand .card')).toHaveCount(13);
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(27);
  for (const card of await cards.all()) {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const positions = await page.locator('.hand .card').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  const viewportWidth = testInfo.project.use.viewport!.width;
  // A 608px hand plus 112px main/table padding needs a 720px viewport.
  // Two suit columns (316px) plus 40px main/table padding need a 356px viewport.
  const expectedHandRows = viewportWidth < 356 ? 4 : viewportWidth < 720 ? 2 : 1;
  expect(new Set(positions.map(p => p.y)).size).toBe(expectedHandRows);
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].y === positions[i - 1].y) expect(positions[i].x - positions[i - 1].x).toBeGreaterThanOrEqual(44);
  }
  const handElements = await page.locator('.learner, .learner *').evaluateAll(elements =>
    elements.map(el => ({ element: el.className || el.tagName, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })));
  for (const element of handElements) {
    expect(element.scrollWidth, `${element.element} must not scroll horizontally`).toBeLessThanOrEqual(element.clientWidth);
  }
  const handCards = await page.locator('.hand .card').evaluateAll(elements => elements.map(el => {
    const card = el.getBoundingClientRect();
    return {
      left: card.left, right: card.right,
      // The visible rank and suit; a playable card also carries a screen-reader-only name.
      spans: [...el.querySelectorAll(':scope > span:not(.sr-only)')].map(span => {
        const box = span.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    };
  }));
  for (const card of handCards) {
    expect(card.left).toBeGreaterThanOrEqual(0);
    expect(card.right).toBeLessThanOrEqual(viewportWidth);
  }
  if (expectedHandRows === 1) {
    for (let i = 0; i < handCards.length - 1; i++) {
      const card = handCards[i];
      const exposedRight = handCards[i + 1].left;
      expect(card.spans).toHaveLength(2);
      for (const span of card.spans) {
        expect(span.left).toBeGreaterThanOrEqual(card.left);
        expect(span.right).toBeLessThanOrEqual(exposedRight);
      }
    }
  }
  const columns = page.locator('.suit-column');
  await expect(columns).toHaveCount(4);
  const columnPositions = await columns.evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
  expect(new Set(columnPositions.map(p => p.x)).size).toBe(4);
  expect(new Set(columnPositions.map(p => p.y)).size).toBe(1);
  await expect(page.getByRole('region', { name: 'West', exact: true })).toHaveText('W · West · 12 cards');
  await expect(page.getByRole('region', { name: 'East', exact: true })).toHaveText('E · East · 13 cards');
  await expect(page.locator('.trick-area').getByRole('img', { name: '9 of spades' })).toBeVisible();
  await expect(page.locator('.led')).toHaveText('LED');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // UX §10: axe needs running timers; North's turn is stable without a robot timer.
  await page.clock.resume();
  async function checkAccessibility() {
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  }
  await checkAccessibility();
  const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
  await ace.click();
  await expect(ace).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Play it, / })).toBeVisible();
  if (viewportWidth !== 320) {
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footer = await page.locator('.action-bar').boundingBox();
  expect(footer).not.toBeNull();
  for (const element of await page.locator('.card, .seat-label').all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    const overlaps = box!.x < footer!.x + footer!.width && box!.x + box!.width > footer!.x
      && box!.y < footer!.y + footer!.height && box!.y + box!.height > footer!.y;
    expect(overlaps).toBe(false);
  }
  if (viewportWidth >= 720) {
    const trick = await page.locator('.trick-area').boundingBox();
    expect(trick!.width).toBe(220);
    expect(trick!.height).toBe(trick!.width);
  }
  await checkAccessibility();
  // Play North's spade, wait for East, then attempt an off-suit card from South.
  await page.getByRole('button', { name: /^Play it, / }).click();
  await expect(page.getByRole('button', { name: 'King of spades, playable', exact: true })).toBeVisible();
  // Three cards are on the table (West, North, East): none may cover an opponent's backs or label.
  await expect(page.locator('.played')).toHaveCount(3);
  const played = await page.locator('.played').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
  const opponents = await page.locator('.opponent .backs, .opponent p').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
  for (const card of played) {
    for (const opponent of opponents) {
      const overlaps = card.left < opponent.right && card.right > opponent.left && card.top < opponent.bottom && card.bottom > opponent.top;
      expect(overlaps, `played card ${JSON.stringify(card)} covers ${JSON.stringify(opponent)}`).toBe(false);
    }
  }
  const heart = page.getByRole('button', { name: "Ace of hearts, can't play: you must follow spades", exact: true });
  await heart.click();
  await page.getByRole('button', { name: /^Play it, / }).click();
  await expect(page.locator('[aria-live="assertive"]')).toHaveText('Not that one. You still have spades.');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await checkAccessibility();
  const initial = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(initial).toBe(testInfo.project.use.colorScheme === 'dark' ? 'rgb(17, 18, 26)' : 'rgb(246, 244, 238)');
  await page.emulateMedia({ colorScheme: testInfo.project.use.colorScheme === 'dark' ? 'light' : 'dark' });
  const other = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(other).not.toBe(initial);
  expect(errors).toEqual([]);
});
