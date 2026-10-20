import { useEffect, useRef, useState } from 'react';
import { followSuit } from '../curriculum/content';
import { createPlayer } from '../curriculum/player';
import { sessionAttempts } from '../progress/attemptStore';
import { createProvenanceLog } from '../coach/provenance';
type ProvenanceLog = ReturnType<typeof createProvenanceLog>;
import { cardName, text, type StringId } from '../explanation';
import { SEATS, type Card as TableCard } from '../table';
import { Card } from './Card';
import { Hand } from './Hand';

export function LessonScreen({ onClose, provenanceLog }: { onClose: () => void; provenanceLog?: ProvenanceLog }) {
  const [player] = useState(() => createPlayer(followSuit.exercises[0], sessionAttempts, 'session-learner'));
  // US-40, CI-5: lesson statements are logged like the practice table's; #49 replaces the literal version.
  const [log] = useState(() => provenanceLog ?? createProvenanceLog('0.0.0'));
  const [state, setState] = useState(player.snapshot);
  const [selected, setSelected] = useState<TableCard | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const showMe = useRef<HTMLButtonElement>(null);
  const continuation = useRef<HTMLButtonElement>(null);
  const started = useRef(false);
  // UX §10: whenever the continuation newly appears (a resolved Prompt, or a commentary step reached
  // after a scripted play), the control that had focus is gone, so focus moves to it.
  const continuationShown = state.kind === 'commentary' || (state.kind === 'prompt' && !!state.outcome);
  useEffect(() => {
    if (continuationShown && started.current) continuation.current?.focus();
    started.current = true;
  }, [continuationShown]);
  const offerShowMe = state.wrongAnswers >= 2 && !state.outcome;
  // UX §10: the second wrong answer removes the focused card controls, so focus moves to Show me.
  useEffect(() => { if (offerShowMe) showMe.current?.focus(); }, [offerShowMe]);
  useEffect(() => {
    if (state.kind !== 'scripted-action') return;
    // UX §6.2: each authored play uses the normal 500 ms display delay.
    const timer = setTimeout(() => setState(player.advanceScript()), 500);
    return () => clearTimeout(timer);
  }, [player, state]);
  const progress = text('lesson.fraction', { current: state.stepIndex + 1, total: state.totalSteps });
  const progressValue = text('lesson.progress-value', { current: state.stepIndex + 1, total: state.totalSteps });
  const active = state.kind === 'prompt' && !state.outcome && state.wrongAnswers < 2;
  const dummySeat = SEATS[(SEATS.indexOf(state.view.contract.declarer) + 2) % 4];
  const answers = state.prompt?.expectedAnswers.map(cardName).join(', ') ?? '';
  function answer(card: TableCard) { setSelected(null); setRuleOpen(false); setState(player.answer(card, Date.now())); }
  function hint() {
    const next = player.showHint();
    // US-14.4, US-40: the first showing of an authored hint is a statement with authored provenance.
    if (!state.hint && next.hint) {
      const { playthroughId } = player.record();
      log.record({ id: `${playthroughId}-hint-${next.stepIndex}`, playthroughId, positionIndex: next.view.positionIndex,
        kind: 'statement', summary: `hint:${next.prompt?.promptId}`, text: text(next.hint.textRef as StringId),
        informationMode: 'VISIBLE', at: new Date().toISOString(),
        provenance: { sourceKind: 'authored', contentId: next.hint.provenance.contentId, version: String(next.hint.provenance.version) } });
    }
    setState(next);
  }
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
        {/* UX §3.1, §6.2: lessons use the normal table, so exposed Dummy shows face up, on its own
            full-width row as on the practice table. */}
        {state.view.dummy && <section className="lesson-dummy" aria-label={text('dummy.seat', { seat: text(`seat.${dummySeat}`) })}>
          <p>{text('dummy.seat', { seat: text(`seat.${dummySeat}`) })}</p>
          <Hand cards={state.view.dummy} dummy active={active && state.view.turn === dummySeat} legalCards={[]}
            selected={selected} onSelect={setSelected} onPlay={answer} />
        </section>}
        <div className="lesson-seats">{(['west', 'north', 'east'] as const).filter(seat => !(seat === dummySeat && state.view.dummy)).map(seat =>
          <span key={seat}>{text('opponent', { seat: text(`seat.${seat}`), count: state.view.cardCounts[seat] })}</span>)}</div>
        <div className="lesson-trick" aria-label={text('trick')}>
          {(state.view.currentTrick.length ? state.view.currentTrick : state.view.tricks.at(-1)?.cards ?? []).map(played =>
            <article key={played.seat}><p>{text(`seat.${played.seat}`)}</p><Card card={played.card} /></article>)}
        </div>
        <section aria-label={text('hand')}>
          {/* UX P-1: no legal-card highlighting or accessible answer clues in following-suit lessons. */}
          <Hand cards={state.view.hand} active={active && state.view.turn === 'south'} legalCards={[]} selected={selected} onSelect={setSelected} onPlay={answer} />
        </section>
      </section>
      <aside className="lesson-panel" aria-label={text('lesson.persona')}>
        <p className="lesson-persona">{text('lesson.persona')}</p>
        {state.textRef && <p>{text(state.textRef as StringId)}</p>}
        {state.kind === 'scripted-action' && <p role="status">{text('lesson.watch')}</p>}
        <div role="alert" aria-atomic="true">
          {state.rejection && <p>{text(`reason.${state.rejection.reason}`, { suit: state.rejection.details.suit ? text(`suit.${state.rejection.details.suit}`) : '' })}</p>}
        </div>
        {state.prompt && <>
          <p>{text(state.prompt.commentaryRef as StringId)}</p>
          <h2>{text(state.prompt.textRef as StringId)}</h2>
          <div role="status" aria-live="polite" aria-atomic="true">
            {state.outcome ? <p>{text((state.outcome === 'failed' ? state.prompt.shownRef : state.prompt.correctRef) as StringId, { answers })}</p>
              : state.wrongAnswers > 0 && <p>{text(state.prompt.wrongRef as StringId)} {state.wrongAnswers === 1 && text('lesson.retry')}</p>}
          </div>
          {state.rejection && <>
            <button type="button" aria-expanded={ruleOpen} aria-controls="lesson-rule" onClick={() => setRuleOpen(!ruleOpen)}>{text('rule.why')}</button>
            <p id="lesson-rule" hidden={!ruleOpen}>{text(`rule.${state.rejection.reason}`)}</p>
          </>}
          {!state.outcome && state.prompt.hint && <button type="button" onClick={hint}>{text('lesson.hint')}</button>}
          {selected && active && <button type="button" onClick={() => answer(selected)} aria-label={text('play.card', { card: cardName(selected) })}>{text('play')}</button>}
          {offerShowMe && <button ref={showMe} type="button" onClick={() => setState(player.showAnswer(Date.now()))}>{text('lesson.show')}</button>}
          {state.hint && <section className="lesson-hint" role="status"><p>{text(state.hint.textRef as StringId)}</p>
            <small>{text('lesson.provenance', state.hint.provenance)}</small></section>}
        </>}
        {(state.kind === 'commentary' || state.outcome && state.kind === 'prompt') &&
          <button ref={continuation} type="button" onClick={() => state.stepIndex === state.totalSteps - 1 ? onClose() : setState(player.next())}>
            {text(state.stepIndex === state.totalSteps - 1 ? 'lesson.done' : 'lesson.next')}</button>}
        <p className="lesson-keys">{text('lesson.keys')}</p>
        <small>{text('lesson.draft')}</small>
      </aside>
      {/* UX §10: every play and trick winner is announced, scripted plays included. Built from the
          learner's Seat View, so it holds only public information. */}
      <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions">
        {[...state.view.tricks.flatMap(trick => [...trick.cards.map(played =>
          text('announce.play', { seat: text(`seat.${played.seat}`), card: cardName(played.card) })),
          text('announce.winner', { seat: text(`seat.${trick.winner}`) })]),
        ...state.view.currentTrick.map(played => text('announce.play', { seat: text(`seat.${played.seat}`), card: cardName(played.card) })),
        ].map((message, index) => <p key={index}>{message}</p>)}
      </div>
    </main>
  </div>;
}
