import { useEffect, useRef, type KeyboardEvent } from 'react';
import { text } from '../explanation';
import type { HintSnapshot } from './hints';

export default function HintSheet({ hint, dismiss }: { hint: HintSnapshot; dismiss: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  // UX §10: keyboard dismissal and focus return without selecting any card.
  useEffect(() => {
    const previous = document.activeElement;
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  // UX §10: a bottom sheet traps focus until dismissed.
  function keyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); dismiss(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }
  return <aside className="hint-sheet" role="region" aria-labelledby="hint-title" onKeyDown={keyDown}>
    <h2 id="hint-title">{text('hint.button')}</h2>
    <p className="hint-label">{text('hint.label')}</p>
    {/* UX §10: abstentions are announced assertively; advice politely. */}
    <div role={hint.abstained ? 'alert' : 'status'} aria-live={hint.abstained ? 'assertive' : 'polite'} aria-busy={hint.thinking}>
      <p>{hint.thinking ? text('hint.thinking') : hint.advice}</p>
      {hint.reason && <p>{hint.reason}</p>}
    </div>
    <p>{text('hint.choose')}</p>
    <button ref={close} type="button" onClick={dismiss}>{text('hint.dismiss')}</button>
  </aside>;
}
