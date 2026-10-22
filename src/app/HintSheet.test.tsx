// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import HintSheet from './HintSheet';

test('thinking is visible until advice arrives; Got it and Escape dismiss, returning focus', () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus();
  const container = document.createElement('div'); document.body.append(container);
  const dismiss = vi.fn();
  const hint = { enabled: true, open: true, thinking: true, advice: '', reason: '', durationMs: null, exceededTarget: false };
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
