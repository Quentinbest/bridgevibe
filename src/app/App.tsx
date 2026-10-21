import { MiniBridgeSetup } from './MiniBridgeSetup';
import { analysisHost } from './analysisHost';
import { ReviewScreen } from './ReviewScreen';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SUITS, type Card as TableCard, type Deal, type CompletedPlaythroughRecord, type ContractChoice } from '../table';
import { cardName, text } from '../explanation';
import { Card, CardBack } from './Card';
import { Hand } from './Hand';
import { type LearnerView } from './play';
import { dealFromUrl, dealSession } from './deals';
import { DealControls } from './DealControls';
import { LessonScreen } from './LessonScreen';
import { lessonById } from '../curriculum/content';

// US-40.2: the constant build guard removes the entire debug import from production.
const DebugPanel = import.meta.env.MODE === 'internal' || import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'development'
  ? lazy(() => import('./DebugPanel')) : null;

function Opponent({ seat, count, cards }: { seat: 'west' | 'east'; count: number; cards?: readonly TableCard[] | null }) {
  return <section className={`opponent ${seat}`} aria-label={text(`seat.${seat}`)}>
    {cards ? <Hand cards={cards} dummy active={false} legalCards={[]} selected={null} onSelect={() => {}} onPlay={() => {}} /> : <div className="backs">{Array.from({ length: Math.min(count, 3) }, (_, index) => <CardBack key={index} />)}</div>}
    <p>{text('opponent', { seat: text(`seat.${seat}`), count })}</p>
  </section>;
}
// ADR-0001, US-16.4: the UI gets deal metadata only, never the play session or its record of all four hands.
export function TableScreen({ view, play, clearRejection, info, invalid, onNew, onShowRule, chooseContract }: { chooseContract?: (choice: ContractChoice) => void; onShowRule?: () => void; info: Pick<Deal, 'dealId' | 'origin'>; invalid: boolean; onNew: () => void; view: LearnerView; clearRejection: () => void; play: (seat: 'north' | 'south', card: TableCard) => void }) {
  const [selected, setSelected] = useState<TableCard | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const tableElement = useRef<HTMLElement | null>(null);
  const wasSetup = useRef(!!view.setup);
  // UX §4.2, §10: choosing below the fold must not leave the opening hand above the viewport.
  useLayoutEffect(() => {
    if (wasSetup.current && !view.setup) tableElement.current?.closest('main')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    wasSetup.current = !!view.setup;
  }, [view.setup]);
  const disclosureElement = useRef<HTMLButtonElement | null>(null);
  // UX §10: restore focus before a focused disclosure is removed, on every dismissal path.
  const disclosureRef = useCallback((element: HTMLButtonElement | null) => {
    if (!element && disclosureElement.current === document.activeElement) {
      const hand = tableElement.current?.querySelector(view.rejectedSeat === 'north' ? '.dummy' : '.hand');
      const card = view.rejectedCard;
      const returned = card && hand?.querySelector<HTMLButtonElement>(`button[data-suit="${card.suit}"][data-rank="${card.rank}"]`);
      (returned || hand?.querySelector<HTMLButtonElement>('button[tabindex="0"]'))?.focus({ preventScroll: true });
    }
    disclosureElement.current = element;
  }, [view.rejectedCard, view.rejectedSeat]);
  function select(card: TableCard | null) { setSelected(card); setRuleOpen(false); clearRejection(); }
  const active = !view.collecting && view.status !== 'completed';
  const target = view.contract ? view.contract.level + 6 : 0;
  // UX §10: an illegal card's name says which suit it must follow.
  const ledSuit = view.collecting ? undefined : view.displayedTrick[0]?.card.suit;
  const banner = view.collecting && view.lastTrickWinner
    ? text('announce.winner', { seat: text(`seat.${view.lastTrickWinner}`) })
    : view.turn === 'west' || view.turn === 'east' ? text(`turn.${view.turn}`)
    : view.contract?.declarer !== 'south' && view.turn ? text(view.displayedTrick.length ? 'turn.seat' : 'turn.seat-lead', { seat: text(`seat.${view.turn}`) })
    : view.turn === 'north' ? text(view.displayedTrick.length ? 'turn.dummy' : 'turn.dummy-lead')
      : text(view.displayedTrick.length ? 'turn.play' : 'turn.lead');
  function submit(card: TableCard) {
    setSelected(null);
    setRuleOpen(false);
    if (view.turn === 'north' || view.turn === 'south') play(view.turn, card);
  }
  return <>
    <header className="header"><div className="header-row">
      <h1 className={invalid ? 'sr-only' : undefined} aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1>
      {invalid && <p className="deal-notice" role="status">{text('deal.invalid')}</p>}
      <DealControls info={info} onNew={onNew} />
    </div></header>
    {view.setup ? <MiniBridgeSetup view={view.setup} choose={choice => chooseContract?.(choice)} /> : view.contract && <main onKeyDown={event => { if (event.key === 'Escape') select(null); }}>
      <section className="status" aria-label={text('status')}>
        <span className="contract">{text('contract.chosen', { objective: view.objective ? text(`objective.${view.objective}`) : '', strain: text(view.contract.strain === 'no-trumps' ? 'strain.no-trumps' : `symbol.${view.contract.strain}`) })}</span>
        {/* 390×844: one status line fits every strain and objective (US-06.5). */}
        <span>{text('declarer.target', { seat: text(`seat.${view.contract.declarer}`), target })}</span>
        <span className="tricks">{text('tricks.sides', { you: view.tricksWon.northSouth, them: view.tricksWon.eastWest })}</span>
      </section>
      <section ref={tableElement} className="table" aria-label={text('table')}>
        <section className="dummy" aria-label={text(view.contract.declarer === 'north' || view.dummySeat !== 'north' ? 'seat.north' : 'dummy')}>
          <p className="seat-label">{text(view.contract.declarer === 'north' ? 'seat.north' : view.dummySeat === 'north' ? 'dummy' : 'seat.north')}</p>
          {view.north ? <Hand cards={view.north} dummy active={active && view.turn === 'north'} legalCards={view.legalCards} ledSuit={ledSuit}
            rejectionId={view.rejectionId} rejectedCard={view.rejectedSeat === 'north' ? view.rejectedCard : null} selected={selected} onSelect={select} onPlay={submit} /> : <>
            <div className="suit-columns">{SUITS.map(suit => <div className="suit-column" key={suit}><CardBack /></div>)}</div>
            <p>{text(view.dummySeat === 'north' ? 'dummy.hidden' : 'opponent', { count: view.cardCounts.north, seat: text('seat.north') })}</p>
          </>}
        </section>
        <Opponent seat="west" count={view.cardCounts.west} cards={view.dummySeat === 'west' ? view.dummy : null} />
        <section className="trick-area" aria-label={text(view.displayedTrick.length ? 'trick' : 'trick.empty')}>
          {view.displayedTrick.map((played, index) => <article className={`played played-${played.seat}`} key={played.seat}>
            <Card card={played.card} />{index === 0 && <b className="led">{text('led')}</b>}
          </article>)}
        </section>
        <Opponent seat="east" count={view.cardCounts.east} cards={view.dummySeat === 'east' ? view.dummy : null} />
        <section className="learner" aria-label={text('hand')}>
          <p className="turn-banner" aria-live="polite">{view.status === 'completed' && !view.collecting ? (view.contract.declarer === 'east' || view.contract.declarer === 'west'
            // US-06.3: defenders defeat the contract with 14 − target tricks, not declarer's target.
            ? text('result.defending', { won: view.tricksWon.northSouth, target: 14 - target })
            : text('result', { won: view.tricksWon.northSouth, target })) : banner}</p>
          <div className="rejection-panel" data-visible={!!view.reason}>
            <p className="reason" aria-live="assertive" aria-atomic="true">{view.reason}</p>
            {view.reasonCode && <>
              <button ref={disclosureRef} type="button" className="rule-disclosure" aria-expanded={ruleOpen} aria-controls="rule-reference"
                onClick={() => { if (!ruleOpen) onShowRule?.(); setRuleOpen(open => !open); }}>{text('rule.why')}</button>
              <p id="rule-reference" className="rule-reference" hidden={!ruleOpen}>{text(`rule.${view.reasonCode}`)}</p>
            </>}
          </div>
          <Hand cards={view.hand} active={active && view.turn === 'south'} legalCards={view.legalCards} ledSuit={ledSuit}
            rejectionId={view.rejectionId} rejectedCard={view.rejectedSeat === 'south' ? view.rejectedCard : null} selected={selected} onSelect={select} onPlay={submit} />
          <p className="seat-label">{text(view.contract.declarer === 'south' ? 'learner' : view.dummySeat === 'south' ? 'learner.dummy' : 'learner.defender')}</p>
        </section>
      </section>
      <footer className="action-bar">{selected && <button type="button" onClick={() => submit(selected)}
        // UX §3.3: the confirmation names the card. The visible label stays "Play it" (issue #2, design),
        // and the name starts with it, so the visible label is part of the name (WCAG 2.5.3).
        aria-label={text('play.card', { card: cardName(selected) })}>{text('play')}</button>}</footer>
      <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions">{view.announcements.map((message, index) => <p key={index}>{message}</p>)}</div>
    </main>}
  </>;
}
function PracticeScreen() {
  const [session, setSession] = useState(() => {
    const initial = dealFromUrl(window.location.search);
    return dealSession(initial.deal, initial.invalid);
  });
  const [review, setReview] = useState<CompletedPlaythroughRecord | null>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const play = session.play;
  const view = useSyncExternalStore(play.subscribe, play.getSnapshot);
  const completed = useMemo(() => view.status === 'completed' ? play.completedRecord() : null, [play, view.status]);
  const analysis = useSyncExternalStore(analysisHost.subscribe, () => analysisHost.snapshot(completed));
  // §4.5, U-13: start at completion, before Hand review is opened.
  // §4.7: a New deal (or leaving) cancels the old record's analysis instead of leaving the solver running.
  const cancelAnalysis = useRef<() => void>(() => {});
  useEffect(() => {
    cancelAnalysis.current = completed ? analysisHost.start(completed, play.provenanceLog) : () => {};
    return () => cancelAnalysis.current();
  }, [completed, play]);
  useEffect(() => play.start(), [play]);
  useEffect(() => { if (!review && view.status === 'completed') reviewButton.current?.focus(); }, [review, view.status]);
  const debug = DebugPanel && new URLSearchParams(window.location.search).get('debug') === '1';
  if (review) return <div className={debug ? 'debug-layout' : undefined}>
    <ReviewScreen onTryAgain={() => { cancelAnalysis.current = analysisHost.retry(review, play.provenanceLog); }} analysis={analysis} record={review} onBack={() => setReview(null)} />
    {debug && <Suspense fallback={null}><DebugPanel play={play} /></Suspense>}
  </div>;
  return <div className={debug ? 'debug-layout' : undefined}><TableScreen key={session.key} view={view} chooseContract={play.chooseContract} play={play.play} clearRejection={play.clearRejection} onShowRule={play.showRule} info={session.info} invalid={session.invalid} onNew={() => setSession(session.next())} />
    {view.status === 'completed' && <div className="review-entry"><button ref={reviewButton} type="button" onClick={() => setReview(play.completedRecord())}>{text('review.title')}</button></div>}
    {debug && <Suspense fallback={null}><DebugPanel key={session.key} play={play} /></Suspense>}
  </div>;
}

export function App() {
  const [lesson, setLesson] = useState(() => lessonById(new URLSearchParams(window.location.search).get('lesson')));
  return lesson ? <LessonScreen lesson={lesson} onClose={() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('lesson');
    window.history.replaceState(null, '', url);
    setLesson(undefined);
  }} /> : <PracticeScreen />;
}
