import { expect, test } from '@playwright/test';
import { choosePractice } from './miniBridge';

// LR-3c: a rejection alone could be CORS; require the enforced CSP violation too.
test('audit CSP blocks a cross-origin request while the app and worker still play', async ({ page }) => {
  await page.goto('/');
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(policy).toContain("connect-src 'self';");
  expect(policy).toContain("default-src 'self';");
  expect(policy).toContain("object-src 'none'; base-uri 'self'");
  const result = await page.evaluate(async () => {
    const violation = new Promise<{ directive: string; blocked: string; disposition: string }>(resolve => {
      document.addEventListener('securitypolicyviolation', event => resolve({
        directive: event.effectiveDirective, blocked: event.blockedURI, disposition: event.disposition,
      }), { once: true });
    });
    const rejected = await fetch('https://unreviewed.invalid/issue-37').then(() => false, () => true);
    return { rejected, ...await violation };
  });
  expect(result).toMatchObject({ rejected: true, directive: 'connect-src', disposition: 'enforce' });
  expect(result.blocked).toContain('https://unreviewed.invalid');
  // LR-3c: images use the default-src fallback, outside connect-src's coverage.
  const imageViolation = await page.evaluate(() => new Promise<{ directive: string; blocked: string; disposition: string }>(resolve => {
    const listener = (event: SecurityPolicyViolationEvent) => {
      if (!event.blockedURI.startsWith('https://unreviewed.invalid')) return;
      document.removeEventListener('securitypolicyviolation', listener);
      resolve({ directive: event.effectiveDirective, blocked: event.blockedURI, disposition: event.disposition });
    };
    document.addEventListener('securitypolicyviolation', listener);
    const image = document.createElement('img');
    image.alt = '';
    image.src = 'https://unreviewed.invalid/issue-37.png';
    document.body.append(image);
  }));
  expect(['img-src', 'default-src']).toContain(imageViolation.directive);
  expect(imageViolation).toMatchObject({ disposition: 'enforce' });
  expect(imageViolation.blocked).toContain('https://unreviewed.invalid');
  await choosePractice(page, false);
  await expect(page.locator('.learner .card')).toHaveCount(13);
  await expect(page.locator('.trick-area .card')).toHaveCount(1, { timeout: 5000 });
});
