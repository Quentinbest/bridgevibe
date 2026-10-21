import { choosePractice } from './miniBridge';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { text } from '../../src/explanation';

// US-01.9 / UX §3.4, §10: shared coverage at every configured width and theme.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`rejection returns only the illegal card and explains the rule (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await page.clock.install(); await page.clock.pauseAt(new Date());
    await page.goto('/'); await choosePractice(page, true); await page.clock.runFor(500);
    const queen = page.getByRole('button', { name: "Queen of hearts, can't play: you must follow spades", exact: true });
    await expect(queen).toBeInViewport();
    const before = await queen.boundingBox();
    await queen.click(); await queen.click();
    const firstRejection = await queen.getAttribute('data-rejection-id');
    await expect(queen).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.dummy .card')).toHaveCount(13);
    await expect(page.locator('.trick-area .card')).toHaveCount(1);
    const live = page.locator('[aria-live="assertive"]');
    await expect(live).toHaveCount(1);
    await expect(live).toHaveText('Not that one. You still have spades.');
    if (reducedMotion === 'reduce') {
      await expect(page.locator('.rejected-card')).toHaveCount(0);
      expect(await queen.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      expect(await queen.evaluate(el => el.getAnimations().length)).toBe(0);
    } else {
      await expect(page.locator('.rejected-card')).toHaveCount(1);
      await expect(queen).toHaveClass(/rejected-card/);
      expect(await queen.evaluate(el => getComputedStyle(el).animationName)).toBe('rejected-card-shake');
    }
    await page.clock.runFor(5000);
    await expect(live).toHaveText('Not that one. You still have spades.');
    // The animation transforms only this card and leaves its layout position unchanged.
    await expect(queen).toHaveCSS('transform', 'none');
    const after = await queen.boundingBox();
    expect(after!.x).toBeCloseTo(before!.x); expect(after!.y).toBeCloseTo(before!.y);
    const disclosure = page.getByRole('button', { name: 'Why is that the rule?', exact: true });
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.focus(); await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    const rule = page.locator(`#${await disclosure.getAttribute('aria-controls')}`);
    await expect(rule).toBeVisible(); await expect(rule).toHaveText(text('rule.must-follow-suit'));
    await expect(live).toHaveText('Not that one. You still have spades.');
    const panel = await page.locator('.rejection-panel').boundingBox();
    if (testInfo.project.use.viewport!.width >= 1068) {
      const table = await page.locator('.table').boundingBox();
      expect(panel!.x).toBeCloseTo(table!.x + table!.width + 24);
      expect(panel!.y).toBeCloseTo(table!.y);
    } else {
      const hand = await page.locator('.hand').boundingBox();
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(hand!.y);
    }
    await page.clock.resume();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press('Space'); await expect(rule).toBeHidden();
    await page.keyboard.press('Enter'); await expect(rule).toBeVisible();
    await expect(disclosure).toBeFocused();
    await page.keyboard.press('Escape'); await expect(live).toBeEmpty();
    await expect(queen).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: "4 of hearts, can't play: you must follow spades", exact: true })).toBeFocused();
    await queen.click(); await queen.click();
    expect(await queen.getAttribute('data-rejection-id')).not.toBe(firstRejection);
    if (reducedMotion === 'reduce') {
      await expect(page.locator('.rejected-card')).toHaveCount(0);
      expect(await queen.evaluate(el => el.getAnimations().length)).toBe(0);
    } else {
      await expect(queen).toHaveClass(/rejected-card/);
      expect(await queen.evaluate(el => getComputedStyle(el).animationName)).toBe('rejected-card-shake');
    }
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Ace of spades, playable', exact: true }).click();
    await expect(live).toBeEmpty();
  });
}
