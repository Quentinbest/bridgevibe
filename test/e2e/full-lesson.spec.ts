import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fullFollowSuit } from '../../src/curriculum/content';
import { cardName } from '../../src/explanation';

async function enter(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).focus();
  await page.keyboard.press('Enter');
}

// US-21.7, US-16.4: full keyboard journey at both reference layouts and in both themes.
test('full lesson, labelled exposure, hidden-card boundary and accessible completion', async ({ page }, info) => {
  await page.clock.install();
  await page.goto('/?lesson=follow-suit-full');
  for (let exercise = 0; exercise < 3; exercise++) {
    const start = [1, 6, 12][exercise];
    await expect(page.getByText(`${start}/16`, { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(start));
    if (info.project.name.startsWith('1440')) {
      const list = page.getByRole('region', { name: 'In this level' });
      await expect(list).toBeVisible();
      await expect(list.locator('[aria-current="step"]')).toHaveCount(1);
      await expect(list.locator('[data-state="upcoming"]').first()).toBeVisible();
      if (exercise) await expect(list.locator('[data-state="done"]').first()).toBeVisible();
    }
    await enter(page, 'Next step');
    if (exercise === 1) {
      const shown = page.locator('figure').filter({ hasText: 'Shown for this lesson' });
      await expect(shown.getByRole('img', { name: '4 of hearts', exact: true })).toBeVisible();
      await expect(shown.getByRole('button')).toHaveCount(0);
      // Before the opening lead, no opponent cards are public except the one Exposure.
      for (const seat of ['north', 'east', 'west'] as const) {
        for (const card of fullFollowSuit.exercises[exercise].deal.hands[seat]) {
          if (seat === 'west' && card.suit === 'hearts' && card.rank === '4') continue;
          await expect(page.getByRole('img', { name: cardName(card), exact: true })).toHaveCount(0);
          await expect(page.getByRole('button', { name: cardName(card), exact: true })).toHaveCount(0);
          expect(await page.locator('body').textContent()).not.toContain(cardName(card));
        }
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await enter(page, 'Next step');
    }
    await page.clock.runFor(1000);
    const card = page.getByRole('button', { name: 'Ace of hearts', exact: true });
    await card.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.clock.runFor(500);
    await expect(page.getByText('Shown for this lesson', { exact: true })).toHaveCount(0);
    await enter(page, exercise === 2 ? 'Finish level' : 'Next step');
  }
  await expect(page.getByRole('heading', { name: 'Level complete' })).toBeFocused();
  await expect(page.locator('dd')).toHaveText(['3', '0']);
  await expect(page.getByText('Skill unlocked: Follow suit', { exact: true })).toBeVisible();
  expect(await page.getByRole('main').textContent()).not.toMatch(/score|star|streak|mastery/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await enter(page, info.project.name.endsWith('dark') ? "That's enough for today" : 'Back to Home');
  await expect(page).not.toHaveURL(/lesson=/);
  await expect(page.getByRole('heading', { name: 'BridgeVibe' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your next move' })).toBeFocused();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '3');
  await expect(page.getByText('3 of 3 learning steps done this session')).toBeVisible();
});
