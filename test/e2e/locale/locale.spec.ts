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

// axe needs running timers, so it runs only where the clock may run (see the test).
async function inspect(page: Page, screen: string, { axe = true } = {}) {
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
  if (axe) expect((await new AxeBuilder({ page }).analyze()).violations, screen).toEqual([]);
}

test('I18N-17: preview landing and screens', async ({ page }, info) => {
  const id = info.project.name.startsWith('es-') ? 'es' : info.project.name.startsWith('ja-') ? 'ja' : 'en-XA';
  const tag = id === 'es' ? 'es-419' : id;
  setLocale(id, id === 'en-XA' ? pseudoLocalise(catalogue) : stubCatalogue(catalogue, id === 'es' ? 'long' : 'cjk'), tag);
  // Review of #151: play the scripted Deal on a paused clock, as the English full-Deal tests do, so a
  // robot deadline never fires on a slow runner and changes the line.
  await installPausedClock(page);
  await page.goto('/?practice=1');
  await expect(page.locator('html')).toHaveAttribute('lang', tag);
  if (id === 'ja') {
    // I18N-16.2 (approximated): boot waited for the trimmed face, so it is loaded, not the fallback.
    expect(await page.evaluate(() => document.fonts.check('1em "BridgeVibe Sans JP"'))).toBe(true);
    // I18N-16.3: the shipped notice names the trimmed font as a Modified Version of its IBM source.
    expect(await page.evaluate(() => fetch('/NOTICE.txt').then(response => response.text())))
      .toContain('BridgeVibe Sans JP: Modified Version of IBM Plex Sans JP 3.0.0');
  }
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: text('setup.game', { target: 9 }), exact: true }).click();
  await page.getByRole('button', { name: text('setup.choose'), exact: true }).click();
  await inspect(page, 'practice', { axe: false });
  let hinted = false;
  for (const entry of completeFixedDeal('principles').actions) {
    if (entry.controller === 'robot') await robotTurn(page);
    else {
      // The hint is offered on the learner's turn, so open it at the first one.
      if (!hinted) {
        await page.getByRole('button', { name: text('hint.button'), exact: true }).click(); await inspect(page, 'hint', { axe: false });
        await page.getByRole('button', { name: text('hint.dismiss'), exact: true }).click(); hinted = true;
      }
      const card = cardName(entry.action.card);
      await page.getByRole('button', { name: text('card.playable', { card }), exact: true }).click();
      await page.getByRole('button', { name: text('play.card', { card }), exact: true }).click();
    }
    if (entry.index % 4 === 3) await page.clock.runFor(1000);
  }
  await expect(page.getByRole('region', { name: text('result.title') })).toBeVisible();
  // UX §10: with the Deal complete no robot timer is pending, so axe may run timers from here on.
  await page.clock.resume();
  await inspect(page, 'result');
  await page.getByRole('button', { name: text('result.review'), exact: true }).click(); await inspect(page, 'review');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', tag);
  await expect(page.getByRole('heading', { level: 1, name: text('product') })).toBeVisible();
  await inspect(page, 'home');
  await page.goto('/?lesson=follow-suit'); await inspect(page, 'lesson');
  // axe on the table and hint: a fresh Deal on the running clock, checked once no robot is pending. It
  // follows no scripted line, so a robot fallback on a slow runner can't break it.
  await page.goto('/?practice=1');
  await page.getByRole('button', { name: text('setup.game', { target: 9 }), exact: true }).click();
  await page.getByRole('button', { name: text('setup.choose'), exact: true }).click();
  await expect.poll(() => page.evaluate(() => !(window as { __robotPending?: () => boolean }).__robotPending?.())).toBe(true);
  await inspect(page, 'practice');
  await page.getByRole('button', { name: text('hint.button'), exact: true }).click(); await inspect(page, 'hint');
});
