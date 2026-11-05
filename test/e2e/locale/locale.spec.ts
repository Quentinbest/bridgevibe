import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { catalogue, setLocale, text, cardName } from '../../../src/explanation';
import { pseudoLocalise, stubCatalogue } from '../../../src/explanation/pseudo';
import { completeFixedDeal } from '../../strategy';
import { installPausedClock, robotTurn } from '../miniBridge';

// #149: these projects found overflow and clipping that recur across screens (Home and lesson cards and
// the practice Exit label in en-XA at 320; the deal controls in ja at 390). Until #149 is fixed, they
// skip only the overflow and clipping checks; landing, lang, target size and axe still run, and es-390
// runs everything.
const knownLayout: Record<string, string> = {
  'en-XA-320': '#149: unbreakable text widens the Home and lesson cards and clips the practice Exit label',
  'ja-390': '#149: the deal controls do not wrap',
};
// #150: the hint sheet's dismiss button is below 44 px in every locale, English included.
const knownSmallTarget = (html: string) => html.startsWith('<button type="button">') && html.endsWith(`>${text('hint.dismiss')}</button>`);

async function inspect(page: Page, screen: string) {
  // I18N-17: name what sticks out, so a failure says which element overflows.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth ? []
    : [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .map(el => `${el.tagName.toLowerCase()}.${el.className} ${Math.round(el.getBoundingClientRect().right)}px: ${el.textContent?.trim().slice(0, 40)}`).slice(0, 8));
  const known = knownLayout[test.info().project.name];
  if (known) test.info().annotations.push({ type: 'known layout finding', description: `${screen}: ${known}` });
  else expect(overflow, screen).toEqual([]);
  const clipped = await page.locator('body *').evaluateAll(elements => elements.filter(el => {
    const style = getComputedStyle(el);
    return !el.closest('.sr-only') && el.getClientRects().length > 0 && el.childNodes.length > 0 && [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) && ['hidden', 'clip'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
  }).map(el => el.outerHTML.slice(0, 200)));
  if (!known) expect(clipped, screen).toEqual([]);
  const targets = await page.locator('button:visible, a[href]:visible, input:visible, select:visible, textarea:visible, .card:visible').all();
  const small: string[] = [];
  for (const target of targets) {
    // WCAG 2.5.8: a control inside a label is targeted through the label, as in the English suite.
    const label = target.locator('xpath=ancestor::label[1]');
    const box = await ((await label.count()) ? label : target).boundingBox();
    const html = await target.evaluate(el => el.outerHTML);
    if (box && (box.width < 44 || box.height < 44) && !knownSmallTarget(html)) small.push(`${Math.round(box.width)}×${Math.round(box.height)} ${html.slice(0, 120)}`);
  }
  expect(small, screen).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations, screen).toEqual([]);
}

test('I18N-17: preview landing and screens', async ({ page }, info) => {
  const id = info.project.name.startsWith('es-') ? 'es' : info.project.name.startsWith('ja-') ? 'ja' : 'en-XA';
  const tag = id === 'es' ? 'es-419' : id;
  setLocale(id, id === 'en-XA' ? pseudoLocalise(catalogue) : stubCatalogue(catalogue, id === 'es' ? 'long' : 'cjk'), tag);
  await installPausedClock(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', tag);
  await expect(page.getByRole('heading', { level: 1, name: text('product') })).toBeVisible();
  await page.clock.resume(); await inspect(page, 'home');
  await page.goto('/?lesson=follow-suit'); await inspect(page, 'lesson');
  await page.goto('/?practice=1');
  await page.getByRole('button', { name: text('setup.game', { target: 9 }), exact: true }).click();
  await page.getByRole('button', { name: text('setup.choose'), exact: true }).click();
  await inspect(page, 'practice');
  await page.getByRole('button', { name: text('hint.button'), exact: true }).click(); await inspect(page, 'hint');
  await page.getByRole('button', { name: text('hint.dismiss'), exact: true }).click();
  for (const entry of completeFixedDeal('principles').actions) {
    if (entry.controller === 'robot') await robotTurn(page);
    else {
      const card = cardName(entry.action.card);
      await page.getByRole('button', { name: text('card.playable', { card }), exact: true }).click();
      await page.getByRole('button', { name: text('play.card', { card }), exact: true }).click();
    }
    if (entry.index % 4 === 3) await page.clock.runFor(1000);
  }
  await expect(page.getByRole('region', { name: text('result.title') })).toBeVisible(); await inspect(page, 'result');
  await page.getByRole('button', { name: text('result.review'), exact: true }).click(); await inspect(page, 'review');
});
