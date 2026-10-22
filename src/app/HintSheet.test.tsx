// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import HintSheet from './HintSheet';

test('thinking is visible until advice arrives; Got it and Escape dismiss, returning focus', () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  const container = document.createElement('div'); document.body.append(container);
  const dismiss = vi.fn();
  const hint = { enabled: true, open: true, thinking: true, abstained: false, advice: '', reason: '', durationMs: null, exceededTarget: false };
  const component = render(<HintSheet hint={hint} dismiss={dismiss} />, { container });
  expect(container.textContent).toContain('Thinking from what you can see…');
  expect(container.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');
  component.rerender(<HintSheet hint={{ ...hint, thinking: false, advice: 'From what you can see, King of spades looks like your best card here.', reason: 'Hidden cards could change the outcome.' }} dismiss={dismiss} />);
  expect(container.textContent).not.toContain('Thinking'); expect(container.textContent).toContain('King of spades');
  expect(container.querySelector('[aria-busy]')?.getAttribute('aria-busy')).toBe('false');
  fireEvent.click(container.querySelector('button')!);
  expect(dismiss).toHaveBeenCalledOnce();
  fireEvent.keyDown(container.querySelector('aside')!, { key: 'Escape' });
  expect(dismiss).toHaveBeenCalledTimes(2);
  component.unmount(); expect(document.activeElement).toBe(opener); container.remove(); opener.remove();
});
test('UX §10: Tab and Shift+Tab stay inside the open sheet', () => {
  const outside = document.createElement('button'); document.body.append(outside);
  const hint = { enabled: true, open: true, thinking: false, abstained: false, advice: 'Advice', reason: '', durationMs: null, exceededTarget: false };
  const { container, unmount } = render(<HintSheet hint={hint} dismiss={vi.fn()} />);
  const sheet = container.querySelector('aside')!, gotIt = container.querySelector('button')!;
  expect(document.activeElement).toBe(gotIt);
  const tab = fireEvent.keyDown(sheet, { key: 'Tab' });
  expect(tab).toBe(false); expect(document.activeElement).toBe(gotIt);
  const back = fireEvent.keyDown(sheet, { key: 'Tab', shiftKey: true });
  expect(back).toBe(false); expect(document.activeElement).toBe(gotIt);
  unmount(); outside.remove();
});
test('UX §10: an abstention is announced assertively, advice politely', () => {
  const base = { enabled: true, open: true, thinking: false, advice: 'No hint is available right now.', reason: '', durationMs: null, exceededTarget: false };
  const { container, rerender, unmount } = render(<HintSheet hint={{ ...base, abstained: true }} dismiss={vi.fn()} />);
  expect(container.querySelector('[role="alert"]')?.getAttribute('aria-live')).toBe('assertive');
  expect(container.querySelector('[role="status"]')).toBeNull();
  rerender(<HintSheet hint={{ ...base, abstained: false, advice: 'Advice' }} dismiss={vi.fn()} />);
  expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
  unmount();
});
