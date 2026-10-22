import { useEffect, useRef, useState } from 'react';
import { followSuit } from '../curriculum/content';
import { createLessonPlayer } from '../curriculum/lessonPlayer';
import type { Lesson } from '../curriculum/model';
import { sessionAttempts } from '../progress/attemptStore';
import { createProvenanceLog } from '../coach/provenance';
import { APP_VERSION } from './appVersion';
type ProvenanceLog = ReturnType<typeof createProvenanceLog>;
import { cardName, text, type StringId } from '../explanation';
import { SEATS, type Card as TableCard } from '../table';
import { Card } from './Card';
import { Hand, RotationNotice } from './Hand';
import { tablePositions, seatLabel, declaringTurn } from './rotation';
import { LevelComplete } from './LevelComplete';

export function LessonScreen({ onClose, provenanceLog, lesson = followSuit }: { onClose: () => void; provenanceLog?: ProvenanceLog; lesson?: Lesson }) {
  const [player] = useState(() => createLessonPlayer(lesson, sessionAttempts, 'session-learner'));
  // US-40, CI-5: lesson statements are logged like the practice table's; #49 replaces the literal version.
  const [log] = useState(() => provenanceLog ?? createProvenanceLog(APP_VERSION));
  const [state, setState] = useState(player.snapshot);
  const [selected, setSelected] = useState<TableCard | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const showMe = useRef<HTMLButtonElement>(null);
  const continuation = useRef<HTMLButtonElement>(null);
  const started = useRef(false);
  // UX §10: whenever the continuation newly appears (a resolved Prompt, or a commentary step reached
  // after a scripted play), the control that had focus is gone, so focus moves to it.
  const continuationShown = state.kind === 'commentary' || state.kind === 'exposure' || (state.kind === 'prompt' && !!state.outcome);
  useEffect(() => {
    if (continuationShown && started.current) continuation.current?.focus();
    started.current = true;
  }, [continuationShown, state.stepIndex]);
  const offerShowMe = state.wrongAnswers >= 2 && !state.outcome;
  // UX §10: the second wrong answer removes the focused card controls, so focus moves to Show me.
  useEffect(() => { if (offerShowMe) showMe.current?.focus(); }, [offerShowMe]);
  useEffect(() => {
    if (state.complete || state.kind !== 'scripted-action') return;
    // UX §6.2: each authored play uses the normal 500 ms display delay.
    const timer = setTimeout(() => setState(player.advanceScript()), 500);
    return () => clearTimeout(timer);
  }, [player, state]);
  const progress = text('lesson.fraction', { current: state.stepIndex + 1, total: state.totalSteps });
  const progressValue = text('lesson.progress-value', { current: state.stepIndex + 1, total: state.totalSteps });
  const active = state.kind === 'prompt' && !state.outcome && state.wrongAnswers < 2;
  const dummySeat = SEATS[(SEATS.indexOf(state.view.contract.declarer) + 2) % 4];
  const positions = tablePositions(state.view.contract.declarer);
  const declaring = state.view.contract.declarer === 'north' || state.view.contract.declarer === 'south';
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
  if (state.summary) return <LevelComplete summary={state.summary} onClose={onClose} />;
  return <div className="lesson-screen" onKeyDown={event => {
    if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); hint(); }
  }}>
    <header className="lesson-header">
      <button type="button" onClick={onClose} aria-label={text('lesson.close')}>{text('lesson.close-symbol')}</button>
      <h1>{text(lesson.titleRef as StringId)}</h1>
      <div role="progressbar" aria-label={text('lesson.progress')} aria-valuemin={1} aria-valuemax={state.totalSteps}
        aria-valuenow={state.stepIndex + 1} aria-valuetext={progressValue}>
        <span className="lesson-dots" aria-hidden="true">{Array.from({ length: state.totalSteps }, (_, index) =>
          <span key={index} data-reached={index <= state.stepIndex} />)}</span>
      </div>
      <span className="lesson-fraction">{progress}</span>
    </header>
    <main className="lesson-layout">
      {state.view.contract.declarer === 'north' && <RotationNotice />}
      <section className={declaring ? 'lesson-table lesson-declaring' : 'lesson-table'} data-rotated={state.view.contract.declarer === 'north'} aria-label={text('table')}>
        <p className="lesson-table-progress">{text('lesson.exercise-progress', { current: state.exerciseIndex + 1, total: state.totalExercises,
          step: state.exerciseStepIndex + 1, steps: state.exerciseTotalSteps })}</p>
        {/* UX §3.1, §6.2: lessons use the normal table, so exposed Dummy shows face up, on its own
            full-width row as on the practice table. */}
        {state.view.dummy && <section className="lesson-dummy" data-seat={dummySeat} data-position={positions[dummySeat]} aria-label={text('dummy.seat', { seat: text(`seat.${dummySeat}`) })}>
          <p>{seatLabel(dummySeat, state.view.contract.declarer)}</p>
          <Hand cards={state.view.dummy} dummy active={active && state.view.turn === dummySeat} legalCards={[]}
            selected={selected} onSelect={setSelected} onPlay={answer} />
        </section>}
        <div className="lesson-seats">{SEATS.filter(seat => seat !== state.view.seat && !(seat === dummySeat && state.view.dummy)).map(seat =>
          <section key={seat} data-seat={seat} data-position={positions[seat]} aria-label={text(`seat.${seat}`)}>
            <p>{seatLabel(seat, state.view.contract.declarer)}</p><span>{text('opponent', { seat: text(`seat.${seat}`), count: state.view.cardCounts[seat] })}</span>
            {state.exposed.filter(entry => entry.seat === seat).map(({ card }) =>
              <figure className="lesson-exposure" key={`${card.suit}-${card.rank}`}>
                <Card card={card} /><figcaption>{text('lesson.exposed')}</figcaption>
              </figure>)}
          </section>)}</div>
        {/* WCAG 4.1.2: a labelled region, so the label is allowed and announced (a plain div's isn't). */}
        <section className="lesson-trick" aria-label={text('trick')}>
          {(state.view.currentTrick.length ? state.view.currentTrick : state.view.tricks.at(-1)?.cards ?? []).map(played =>
            <article className={`played played-${positions[played.seat]}`} data-seat={played.seat} key={played.seat}><p>{text(`seat.${played.seat}`)}</p><Card card={played.card} /></article>)}
        </section>
        <p className="turn-banner lesson-turn" tabIndex={-1} aria-live="polite">{active && state.view.turn
          ? declaring ? declaringTurn(state.view.turn, state.view.contract.declarer) : text('turn.seat', { seat: text(`seat.${state.view.turn}`) }) : ''}</p>
        <section className="lesson-own" data-seat={state.view.seat} data-position={positions[state.view.seat]} aria-label={text('hand')}>
          <p>{seatLabel(state.view.seat, state.view.contract.declarer)}</p>
          {/* UX P-1: no legal-card highlighting or accessible answer clues in following-suit lessons. */}
          <Hand cards={state.view.hand} active={active && state.view.turn === state.view.seat} legalCards={[]} selected={selected} onSelect={setSelected} onPlay={answer} />
        </section>
      </section>
      <aside className="lesson-panel" aria-label={text('lesson.persona')}>
        <p className="lesson-persona">{text('lesson.persona')}</p>
        {state.textRef && <p>{text(state.textRef as StringId)}</p>}
        {state.kind === 'scripted-action' && <p role="status">{text('lesson.watch')}</p>}
        {state.kind === 'exposure' && <p role="status">{text('lesson.exposure-note')}</p>}
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
        {continuationShown &&
          <button ref={continuation} type="button" onClick={() => { setSelected(null); setRuleOpen(false); setState(player.next()); }}>
            {text(state.stepIndex === state.totalSteps - 1 ? 'lesson.finish' : 'lesson.next')}</button>}
        <section className="lesson-step-list" aria-label={text('lesson.in-level')}>
          <h2>{text('lesson.in-level')}</h2>
          <ol>{state.steps.map((step, index) => <li key={index} aria-current={index === state.stepIndex ? 'step' : undefined}
            data-state={index < state.stepIndex ? 'done' : index === state.stepIndex ? 'current' : 'upcoming'}>
            {text('lesson.step-item', { exercise: step.exerciseIndex + 1, step: text(`lesson.step.${step.kind}`),
              status: text(index < state.stepIndex ? 'lesson.step.done' : index === state.stepIndex ? 'lesson.step.current' : 'lesson.step.upcoming') })}
          </li>)}</ol>
        </section>
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
