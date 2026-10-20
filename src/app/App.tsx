import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SUITS, type Card as TableCard, type Deal } from '../table';
import { cardName, text } from '../explanation';
import { Card, CardBack } from './Card';
import { Hand } from './Hand';
import { type LearnerView } from './play';
import { dealFromUrl, dealSession } from './deals';
import { DealControls } from './DealControls';

// US-40.2: the constant build guard removes the entire debug import from production.
const DebugPanel = import.meta.env.MODE === 'internal' || import.meta.env.MODE === 'audit' || import.meta.env.MODE === 'development'
  ? lazy(() => import('./DebugPanel')) : null;

function Opponent({ seat, count }: { seat: 'west' | 'east'; count: number }) {
  return <section className={`opponent ${seat}`} aria-label={text(`seat.${seat}`)}>
    <div className="backs">{Array.from({ length: Math.min(count, 3) }, (_, index) => <CardBack key={index} />)}</div>
    <p>{text('opponent', { seat: text(`seat.${seat}`), count })}</p>
  </section>;
}
// ADR-0001, US-16.4: the UI gets deal metadata only, never the play session or its record of all four hands.
export function TableScreen({ view, play, clearRejection, info, invalid, onNew, onShowRule }: { onShowRule?: () => void; info: Pick<Deal, 'dealId' | 'origin'>; invalid: boolean; onNew: () => void; view: LearnerView; clearRejection: () => void; play: (seat: 'north' | 'south', card: TableCard) => void }) {
  const [selected, setSelected] = useState<TableCard | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const tableElement = useRef<HTMLElement | null>(null);
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
  const target = view.contract.level + 6;
  // UX §10: an illegal card's name says which suit it must follow.
  const ledSuit = view.collecting ? undefined : view.displayedTrick[0]?.card.suit;
  const banner = view.collecting && view.lastTrickWinner
    ? text('announce.winner', { seat: text(`seat.${view.lastTrickWinner}`) })
    : view.turn === 'west' || view.turn === 'east' ? text(`turn.${view.turn}`)
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
    <main onKeyDown={event => { if (event.key === 'Escape') select(null); }}>
      <section className="status" aria-label={text('status')}>
        <span className="contract">{text('contract.3nt')}</span>
        <span>{text('declarer', { seat: text(`seat.${view.contract.declarer}`) })}</span>
        <span>{text('target', { target })}</span>
        <span className="tricks">{text('tricks.sides', { you: view.tricksWon.northSouth, them: view.tricksWon.eastWest })}</span>
      </section>
      <section ref={tableElement} className="table" aria-label={text('table')}>
        <section className="dummy" aria-label={text('dummy')}>
          <p className="seat-label">{text('dummy')}</p>
          {view.dummy ? <Hand cards={view.dummy} dummy active={active && view.turn === 'north'} legalCards={view.legalCards} ledSuit={ledSuit}
            rejectionId={view.rejectionId} rejectedCard={view.rejectedSeat === 'north' ? view.rejectedCard : null} selected={selected} onSelect={select} onPlay={submit} /> : <>
            <div className="suit-columns">{SUITS.map(suit => <div className="suit-column" key={suit}><CardBack /></div>)}</div>
            <p>{text('dummy.hidden', { count: view.cardCounts.north })}</p>
          </>}
        </section>
        <Opponent seat="west" count={view.cardCounts.west} />
        <section className="trick-area" aria-label={text(view.displayedTrick.length ? 'trick' : 'trick.empty')}>
          {view.displayedTrick.map((played, index) => <article className={`played played-${played.seat}`} key={played.seat}>
            <Card card={played.card} />{index === 0 && <b className="led">{text('led')}</b>}
          </article>)}
        </section>
        <Opponent seat="east" count={view.cardCounts.east} />
        <section className="learner" aria-label={text('hand')}>
          <p className="turn-banner" aria-live="polite">{view.status === 'completed' && !view.collecting ? text('result', { won: view.tricksWon.northSouth, target }) : banner}</p>
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
          <p className="seat-label">{text('learner')}</p>
        </section>
      </section>
      <footer className="action-bar">{selected && <button type="button" onClick={() => submit(selected)}
        // UX §3.3: the confirmation names the card. The visible label stays "Play it" (issue #2, design),
        // and the name starts with it, so the visible label is part of the name (WCAG 2.5.3).
        aria-label={text('play.card', { card: cardName(selected) })}>{text('play')}</button>}</footer>
      <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions">{view.announcements.map((message, index) => <p key={index}>{message}</p>)}</div>
    </main>
  </>;
}
export function App() {
  const [session, setSession] = useState(() => {
    const initial = dealFromUrl(window.location.search);
    return dealSession(initial.deal, initial.invalid);
  });
  const play = session.play;
  const view = useSyncExternalStore(play.subscribe, play.getSnapshot);
  useEffect(() => play.start(), [play]);
  const debug = DebugPanel && new URLSearchParams(window.location.search).get('debug') === '1';
  return <div className={debug ? 'debug-layout' : undefined}><TableScreen key={session.info.dealId} view={view} play={play.play} clearRejection={play.clearRejection} onShowRule={play.showRule} info={session.info} invalid={session.invalid} onNew={() => setSession(session.next())} />
    {debug && <Suspense fallback={null}><DebugPanel key={session.info.dealId} play={play} /></Suspense>}
  </div>;
}
