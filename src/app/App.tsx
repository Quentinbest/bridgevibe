import { useEffect, useState, useSyncExternalStore } from 'react';
import { SUITS, type Card as TableCard } from '../table';
import { cardName, text } from '../explanation';
import { Card, CardBack } from './Card';
import { Hand } from './Hand';
import { type LearnerView } from './play';
import { dealFromUrl, dealSession } from './deals';
import { DealControls } from './DealControls';

function Opponent({ seat, count }: { seat: 'west' | 'east'; count: number }) {
  return <section className={`opponent ${seat}`} aria-label={text(`seat.${seat}`)}>
    <div className="backs">{Array.from({ length: Math.min(count, 3) }, (_, index) => <CardBack key={index} />)}</div>
    <p>{text('opponent', { seat: text(`seat.${seat}`), count })}</p>
  </section>;
}
function TableScreen({ view, play, session, onNew }: { session: ReturnType<typeof dealSession>; onNew: () => void; view: LearnerView; play: (seat: 'north' | 'south', card: TableCard) => void }) {
  const [selected, setSelected] = useState<TableCard | null>(null);
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
    if (view.turn === 'north' || view.turn === 'south') play(view.turn, card);
  }
  return <>
    <header className="header"><div className="header-row">
      <h1 className={session.invalid ? 'sr-only' : undefined} aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1>
      {session.invalid && <p className="deal-notice" role="status">{text('deal.invalid')}</p>}
      <DealControls info={session.info} onNew={onNew} />
    </div></header>
    <main>
      <section className="status" aria-label={text('status')}>
        <span className="contract">{text('contract.3nt')}</span>
        <span>{text('declarer', { seat: text(`seat.${view.contract.declarer}`) })}</span>
        <span>{text('target', { target })}</span>
        <span className="tricks">{text('tricks.sides', { you: view.tricksWon.northSouth, them: view.tricksWon.eastWest })}</span>
      </section>
      <section className="table" aria-label={text('table')}>
        <section className="dummy" aria-label={text('dummy')}>
          <p className="seat-label">{text('dummy')}</p>
          {view.dummy ? <Hand cards={view.dummy} dummy active={active && view.turn === 'north'} legalCards={view.legalCards} ledSuit={ledSuit}
            selected={selected} onSelect={setSelected} onPlay={submit} /> : <>
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
          <p className="reason" aria-live="assertive">{view.reason}</p>
          <Hand cards={view.hand} active={active && view.turn === 'south'} legalCards={view.legalCards} ledSuit={ledSuit}
            selected={selected} onSelect={setSelected} onPlay={submit} />
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
  return <TableScreen key={session.info.dealId} view={view} play={play.play} session={session} onNew={() => setSession(session.next())} />;
}
