import { useEffect, useRef } from 'react';
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
  return <aside className="hint-sheet" role="region" aria-labelledby="hint-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); dismiss(); } }}>
    <h2 id="hint-title">{text('hint.button')}</h2>
    <p className="hint-label">{text('hint.label')}</p>
    <div role="status" aria-live="polite" aria-busy={hint.thinking}>
      <p>{hint.thinking ? text('hint.thinking') : hint.advice}</p>
      {hint.reason && <p>{hint.reason}</p>}
    </div>
    <p>{text('hint.choose')}</p>
    <button ref={close} type="button" onClick={dismiss}>{text('hint.dismiss')}</button>
  </aside>;
}
