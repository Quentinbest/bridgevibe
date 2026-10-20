import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('seed links reproduce South and IDs; New deal advances; info is keyboard accessible', async ({ page }) => {
  await page.goto('/?seed=abc&deal=3');
  const hand = () => page.locator('.learner .card').allTextContents();
  const firstHand = await hand();
  const trigger = page.getByRole('button', { name: 'Deal info', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Deal info' });
  await expect(dialog).toBeVisible();
  const id = await dialog.getByTestId('deal-id').textContent();
  await expect(dialog).toContainText('abc');
  await expect(dialog).toContainText('bv-deal-1');
  await expect(dialog.locator('.card')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.goto('/?seed=abc&deal=3');
  expect(await hand()).toEqual(firstHand);
  await trigger.click();
  await expect(dialog.getByTestId('deal-id')).toHaveText(id!);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'New deal', exact: true }).click();
  await expect(page).toHaveURL(/seed=abc&deal=4$/);
  expect(await hand()).not.toEqual(firstHand);
  await trigger.click();
  await expect(dialog.getByTestId('deal-id')).not.toHaveText(id!);
});

test('authored info shows its origin and New deal creates a seed link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Deal info', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('fixture.issue-2');
  await expect(dialog).toContainText('Authored');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New deal', exact: true }).click();
  await expect(page).toHaveURL(/seed=[A-Za-z0-9_-]{12}&deal=1$/);
});

test('long seeded suits remain inside the viewport with 44px targets', async ({ page }) => {
  await page.goto('/?seed=abc&deal=17');
  await expect(page.locator('.learner .card')).toHaveCount(13);
  const width = page.viewportSize()!.width;
  for (const card of await page.locator('.learner .card').all()) {
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const clubs = await page.locator('.learner .hand-suit[data-suit="clubs"] .card')
    .evaluateAll(cards => cards.map(card => card.getBoundingClientRect().toJSON()));
  expect(clubs).toHaveLength(7);
  for (let i = 1; i < clubs.length; i++) {
    const previous = clubs[i - 1], current = clubs[i];
    if (current.y === previous.y) expect(current.x - previous.x).toBeGreaterThanOrEqual(44);
    else expect(current.y - previous.y).toBeGreaterThanOrEqual(previous.height);
  }
  for (const button of await page.locator('.deal-controls > button').all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('header controls and invalid-link feedback preserve the fixed Deal height', async ({ page }) => {
  let headerHeight = 0;
  for (const url of ['/', '/?seed=bad!&deal=3']) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const ace = page.getByRole('button', { name: 'Ace of spades, playable', exact: true });
    await ace.click();
    const header = await page.locator('.header').boundingBox();
    const row = await page.locator('.header-row').boundingBox();
    expect(row!.height).toBe(44);
    if (headerHeight) expect(header!.height).toBe(headerHeight);
    headerHeight = header!.height;
    for (const button of await page.locator('.deal-controls > button').all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.y).toBe(row!.y);
      expect(box!.x + box!.width).toBeLessThanOrEqual(row!.x + row!.width);
    }
    if (url !== '/') {
      const notice = await page.getByRole('status').boundingBox();
      expect(notice!.y).toBeGreaterThanOrEqual(row!.y);
      expect(notice!.y + notice!.height).toBeLessThanOrEqual(row!.y + row!.height);
    }
    if (page.viewportSize()!.width !== 320) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    }
  }
});

// UX §10: the learner's turn arriving never pulls focus away from the header's deal controls.
test('a robot play reaching the learner keeps focus on Deal info', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?seed=abc&deal=3');
  const trigger = page.getByRole('button', { name: 'Deal info', exact: true });
  await trigger.focus();
  await page.clock.runFor(600);
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(600);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
