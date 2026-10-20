import { useEffect, useState } from 'react';
import { followSuit } from '../curriculum/content';
import { createPlayer } from '../curriculum/player';
import { sessionAttempts } from '../curriculum/attemptStore';
import { cardName, text, type StringId } from '../explanation';
import type { Card as TableCard } from '../table';
import { Card } from './Card';
import { Hand } from './Hand';

export function LessonScreen({ onClose }: { onClose: () => void }) {
  const [player] = useState(() => createPlayer(followSuit.exercises[0], sessionAttempts, 'session-learner'));
  const [state, setState] = useState(player.snapshot);
  const [selected, setSelected] = useState<TableCard | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  useEffect(() => {
    if (state.kind !== 'scripted-action') return;
    // UX §6.2: each authored play uses the normal 500 ms display delay.
    const timer = setTimeout(() => setState(player.advanceScript()), 500);
    return () => clearTimeout(timer);
  }, [player, state]);
  const progress = text('lesson.fraction', { current: state.stepIndex + 1, total: state.totalSteps });
  const progressValue = text('lesson.progress-value', { current: state.stepIndex + 1, total: state.totalSteps });
  const active = state.kind === 'prompt' && !state.outcome && state.wrongAnswers < 2;
  const answers = state.prompt?.expectedAnswers.map(cardName).join(', ') ?? '';
  function answer(card: TableCard) { setSelected(null); setRuleOpen(false); setState(player.answer(card, Date.now())); }
  const hint = () => setState(player.showHint());
  return <div className="lesson-screen" onKeyDown={event => {
    if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); hint(); }
  }}>
    <header className="lesson-header">
      <button type="button" onClick={onClose} aria-label={text('lesson.close')}>{text('lesson.close-symbol')}</button>
      <h1>{text('lesson.title')}</h1>
      <div role="progressbar" aria-label={text('lesson.progress')} aria-valuemin={1} aria-valuemax={state.totalSteps}
        aria-valuenow={state.stepIndex + 1} aria-valuetext={progressValue}>
        <span className="lesson-dots" aria-hidden="true">{Array.from({ length: state.totalSteps }, (_, index) =>
          <span key={index} data-reached={index <= state.stepIndex} />)}</span>
      </div>
      <span className="lesson-fraction">{progress}</span>
    </header>
    <main className="lesson-layout">
      <section className="lesson-table" aria-label={text('table')}>
        <div className="lesson-seats">{(['west', 'north', 'east'] as const).map(seat =>
          <span key={seat}>{text('opponent', { seat: text(`seat.${seat}`), count: state.view.cardCounts[seat] })}</span>)}</div>
        <div className="lesson-trick" aria-label={text('trick')}>
          {(state.view.currentTrick.length ? state.view.currentTrick : state.view.tricks.at(-1)?.cards ?? []).map(played =>
            <article key={played.seat}><p>{text(`seat.${played.seat}`)}</p><Card card={played.card} /></article>)}
        </div>
        <section aria-label={text('hand')}>
          {/* UX P-1: no legal-card highlighting or accessible answer clues in following-suit lessons. */}
          <Hand cards={state.view.hand} active={active} legalCards={[]} selected={selected} onSelect={setSelected} onPlay={answer} />
        </section>
      </section>
      <aside className="lesson-panel" aria-label={text('lesson.persona')}>
        <p className="lesson-persona">{text('lesson.persona')}</p>
        {state.textRef && <p>{text(state.textRef as StringId)}</p>}
        {state.kind === 'scripted-action' && <p role="status">{text('lesson.watch')}</p>}
        {state.prompt && <>
          <p>{text(state.prompt.commentaryRef as StringId)}</p>
          <h2>{text(state.prompt.textRef as StringId)}</h2>
          <div role="status" aria-live="polite" aria-atomic="true">
            {state.outcome ? <p>{text((state.outcome === 'failed' ? state.prompt.shownRef : state.prompt.correctRef) as StringId, { answers })}</p>
              : state.wrongAnswers > 0 && <p>{text(state.prompt.wrongRef as StringId)} {state.wrongAnswers === 1 && text('lesson.retry')}</p>}
            {state.rejection && <p>{text(`reason.${state.rejection.reason}`, { suit: state.rejection.details.suit ? text(`suit.${state.rejection.details.suit}`) : '' })}</p>}
          </div>
          {state.rejection && <>
            <button type="button" aria-expanded={ruleOpen} aria-controls="lesson-rule" onClick={() => setRuleOpen(!ruleOpen)}>{text('rule.why')}</button>
            <p id="lesson-rule" hidden={!ruleOpen}>{text(`rule.${state.rejection.reason}`)}</p>
          </>}
          {!state.outcome && <button type="button" onClick={hint}>{text('lesson.hint')}</button>}
          {selected && active && <button type="button" onClick={() => answer(selected)} aria-label={text('play.card', { card: cardName(selected) })}>{text('play')}</button>}
          {state.wrongAnswers >= 2 && !state.outcome && <button type="button" onClick={() => setState(player.showAnswer(Date.now()))}>{text('lesson.show')}</button>}
          {state.hint && <section className="lesson-hint" role="status"><p>{text(state.hint.textRef as StringId)}</p>
            <small>{text('lesson.provenance', state.hint.provenance)}</small></section>}
        </>}
        {(state.kind === 'commentary' || state.outcome && state.kind === 'prompt') &&
          <button type="button" onClick={() => state.stepIndex === state.totalSteps - 1 ? onClose() : setState(player.next())}>
            {text(state.stepIndex === state.totalSteps - 1 ? 'lesson.done' : 'lesson.next')}</button>}
        <p className="lesson-keys">{text('lesson.keys')}</p>
        <small>{text('lesson.draft')}</small>
      </aside>
    </main>
  </div>;
}
