import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const tokens = readFileSync(new URL('tokens.css', import.meta.url), 'utf8');
function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6});`));
  if (!match) throw new Error(`missing token --${name}`);
  return match[1];
}
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
// Card ranks and suits are 17–23px semibold, below WCAG's large-text size, so they need 4.5:1.
test.each(['suit-black', 'suit-red', 'suit-orange', 'suit-green'])('%s meets AA contrast on the card face', name => {
  expect(contrast(token(name), token('card-face'))).toBeGreaterThanOrEqual(4.5);
});
