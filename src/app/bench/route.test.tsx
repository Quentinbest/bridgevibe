// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); window.history.replaceState(null, '', '/'); });
test('production ignores ?bench=1 and renders the normal app', async () => {
  vi.stubEnv('MODE', 'production'); vi.resetModules();
  window.history.replaceState(null, '', '/?bench=1');
  const { App } = await import('../App');
  const { container } = render(<App />);
  expect(container.querySelector('.home-shell')).not.toBeNull();
  expect(container.querySelector('[data-bench]')).toBeNull();
});
