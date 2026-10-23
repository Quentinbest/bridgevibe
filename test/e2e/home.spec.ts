import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installPausedClock } from './miniBridge';

test('Home, token themes, session progress, responsive navigation and axe at every configured size', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BridgeVibe' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0 of 3 learning steps done this session');
  await expect(page.getByRole('heading', { name: 'Follow suit' })).toBeVisible();
  await expect(page.getByText('Skill: Follow suit')).toBeVisible();
  await expect(page.getByText(/Level [0-9]/)).toHaveCount(0);
  await expect(page.getByText('About 4 min left')).toBeVisible();
  await expect(page.getByText(/0 deals played this session/)).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main' });
  await expect(navigation.getByRole('link')).toHaveText(['Learn', 'Practice']);
  await expect(navigation.getByRole('link', { name: 'Learn', exact: true })).toHaveAttribute('aria-current', 'page');
  const box = (await navigation.boundingBox())!;
  const viewport = page.viewportSize()!;
  if (viewport.width >= 900) { expect(box.x).toBe(0); expect(box.y).toBe(0); expect(box.height).toBe(viewport.height); }
  else { expect(box.x).toBe(0); expect(box.width).toBe(viewport.width); expect(box.y + box.height).toBe(viewport.height); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const link of await page.getByRole('link').all()) {
    const target = (await link.boundingBox())!;
    expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('keyboard lesson card and both navigation destinations work, with Exit focus on Home', async ({ page }) => {
  await installPausedClock(page); await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Skill: Follow suit.*Follow suit.*Open lesson/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/lesson=follow-suit-full/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '16');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Learn', exact: true })).toBeFocused();
  // UX §2.3: the current Learn tab stays on the Learn landing; the lesson card starts the lesson.
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/lesson=/);
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeVisible();
  await page.getByRole('link', { name: 'Practice', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'MiniBridge Setup' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
});

test('Quick deal starts setup; browser Back returns to Home and reload clears the session', async ({ page }) => {
  await installPausedClock(page); await page.goto('/');
  await page.getByRole('link', { name: /^Quick deal/ }).click();
  await expect(page.getByRole('heading', { name: 'MiniBridge Setup' })).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.locator('.setup-points li')).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await expect(page.getByText(/0 deals played this session/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
});

test('navigation changes from bottom bar to left rail exactly at 900px', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 899, height: 900 });
  let box = (await page.getByRole('navigation').boundingBox())!;
  expect(box.width).toBe(899); expect(box.y).toBeGreaterThan(0);
  await page.setViewportSize({ width: 900, height: 900 });
  box = (await page.getByRole('navigation').boundingBox())!;
  expect(box.height).toBe(900); expect(box.width).toBeLessThan(899); expect(box.y).toBe(0);
});

// UX §2.1: leaving an activity consumes its history entry, so Back never reopens or restarts it.
test('Exit and Close leave no activity entry behind for browser Back', async ({ page }) => {
  await page.goto('/');
  const start = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: /^Quick deal/ }).click();
  await expect(page).toHaveURL(/practice=1/);
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await expect(page).not.toHaveURL(/practice=1/);
  await page.getByRole('link', { name: /Skill: Follow suit.*Open lesson/ }).click();
  await page.getByRole('button', { name: 'Close lesson', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  // Back from Home now leaves the app's Home entry; it never lands on practice or the lesson.
  expect(await page.evaluate(() => history.length)).toBe(start + 1);
  await page.goBack();
  expect(page.url()).not.toMatch(/practice=1|lesson=/);
});

// UX §2.1: New deal keeps the launcher's history marker, so Exit still consumes the practice entry.
test('Exit after New deal leaves no duplicate Home entry', async ({ page }) => {
  await page.goto('/');
  const start = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: /^Quick deal/ }).click();
  await page.getByRole('button', { name: 'New deal', exact: true }).click();
  await expect(page).toHaveURL(/seed=/);
  await page.getByRole('button', { name: 'Exit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(start + 1);
  expect(await page.evaluate(() => history.state)).toBeNull();
});
