import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('static table is accessible, responsive and follows the device theme', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { level: 1, name: 'BridgeVibe' })).toHaveCount(1);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByText('3NT', { exact: true })).toBeVisible();
  await expect(page.getByText('Declarer: South', { exact: true })).toBeVisible();
  await expect(page.getByText('Tricks: 0 / 9', { exact: true })).toBeVisible();
  const cards = page.getByRole('img');
  await expect(cards).toHaveCount(26);
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
      spans: [...el.querySelectorAll('span')].map(span => {
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
  await expect(page.getByRole('region', { name: 'West', exact: true })).toHaveText('West · 13 cards');
  await expect(page.getByRole('region', { name: 'East', exact: true })).toHaveText('East · 13 cards');
  expect(await page.locator('.trick-area').innerText()).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  const initial = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(initial).toBe(testInfo.project.use.colorScheme === 'dark' ? 'rgb(17, 18, 26)' : 'rgb(246, 244, 238)');
  await page.emulateMedia({ colorScheme: testInfo.project.use.colorScheme === 'dark' ? 'light' : 'dark' });
  const other = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(other).not.toBe(initial);
  expect(errors).toEqual([]);
});
