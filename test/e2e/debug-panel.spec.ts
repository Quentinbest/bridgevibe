import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('US-40.2: debug panel requires the URL opt-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  await expect(page.getByRole('complementary', { name: 'Provenance log' })).toHaveCount(0);
});
test('US-40.1–3: entries, counters, grading download and current Seat Views', async ({ page }) => {
  await page.goto('/?debug=1');
  const panel = page.getByRole('complementary', { name: 'Provenance log' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('ol li')).toHaveCount(1);
  await expect(panel.locator('ol')).toContainText('VISIBLE');
  await expect(panel.locator('ol')).toContainText('Source kind');
  await expect(panel.locator('ol')).toContainText('robot');
  await expect(panel.locator('.debug-counters dd')).toHaveText(['0', '0']);
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export log (JSON)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('bridgevibe-f5.json');
  const document = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(document).toMatchObject({ schemaVersion: 1, format: 'bridgevibe-f5', appVersion: '0.0.0', entries: [
    { kind: 'robot-action', informationMode: 'VISIBLE', provenance: { sourceKind: 'robot' }, grade: null, graderNote: null },
  ] });
  await panel.getByRole('button', { name: 'Show seat view' }).click();
  for (const seat of ['north', 'east', 'south', 'west']) {
    await panel.getByLabel('Seat', { exact: true }).selectOption(seat);
    const view = JSON.parse((await panel.locator('#debug-seat-view').textContent())!);
    expect(view.seat).toBe(seat); expect(view.positionIndex).toBe(1);
    expect(view.hand).toHaveLength(seat === 'west' ? 12 : 13);
  }
  if (page.viewportSize()!.width === 1440) expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
