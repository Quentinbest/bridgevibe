import { choosePractice } from './miniBridge';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
// #49: the export names the injected package version.
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test('US-40.2: debug panel requires the URL opt-in', async ({ page }) => {
  await page.goto('/'); await choosePractice(page, false);
  await expect(page.locator('.trick-area .card')).toHaveCount(1);
  await expect(page.getByRole('complementary', { name: 'Provenance log' })).toHaveCount(0);
});
test('US-40.1–3: entries, counters, grading download and current Seat Views', async ({ page }) => {
  await page.goto('/?debug=1'); await choosePractice(page);
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
  expect(document).toMatchObject({ schemaVersion: 1, format: 'bridgevibe-f5', appVersion: version, entries: [
    { kind: 'robot-action', informationMode: 'VISIBLE', provenance: { sourceKind: 'robot' }, grade: null, graderNote: null },
  ] });
  await panel.getByRole('button', { name: 'Show seat view' }).click();
  await expect(panel.locator('#debug-seat-view')).toBeVisible();
  for (const seat of ['north', 'east', 'south', 'west']) {
    await panel.getByLabel('Seat', { exact: true }).selectOption(seat);
    await expect(panel.locator('#debug-seat-view')).toBeVisible();
    const view = JSON.parse((await panel.locator('#debug-seat-view').textContent())!);
    expect(view.seat).toBe(seat); expect(view.positionIndex).toBe(1);
    expect(view.hand).toHaveLength(seat === 'west' ? 12 : 13);
  }
  if (page.viewportSize()!.width === 1440) {
    // US-40.2, UX §3.1: the debug panel must leave room for the 608px hand and 32px felt padding.
    const felt = await page.locator('.table').boundingBox();
    const hand = await page.locator('.hand').boundingBox();
    expect(felt!.width).toBeGreaterThanOrEqual(640);
    expect(hand!.x).toBeGreaterThanOrEqual(felt!.x + 16);
    expect(hand!.x + hand!.width).toBeLessThanOrEqual(felt!.x + felt!.width - 16);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
