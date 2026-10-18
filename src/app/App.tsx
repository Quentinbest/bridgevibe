import { useEffect, useState, useSyncExternalStore } from 'react';
import { SUITS, type Card as TableCard } from '../table';
import { text } from '../explanation';
import { Card, CardBack } from './Card';
import { Hand } from './Hand';
import { createPlay, type LearnerView } from './play';

function Opponent({ seat, count }: { seat: 'west' | 'east'; count: number }) {
  return <section className={`opponent ${seat}`} aria-label={text(`seat.${seat}`)}>
    <div className="backs">{Array.from({ length: Math.min(count, 3) }, (_, index) => <CardBack key={index} />)}</div>
    <p>{text('opponent', { seat: text(`seat.${seat}`), count })}</p>
  </section>;
}
function TableScreen({ view, play }: { view: LearnerView; play: (seat: 'north' | 'south', card: TableCard) => void }) {
  const [selected, setSelected] = useState<TableCard | null>(null);
  const active = !view.collecting && view.status !== 'completed';
  const target = view.contract.level + 6;
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
    <header className="header"><h1 aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1></header>
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
          {view.dummy ? <Hand cards={view.dummy} dummy active={active && view.turn === 'north'} legalCards={view.legalCards}
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
          <Hand cards={view.hand} active={active && view.turn === 'south'} legalCards={view.legalCards}
            selected={selected} onSelect={setSelected} onPlay={submit} />
          <p className="seat-label">{text('learner')}</p>
        </section>
      </section>
      <footer className="action-bar">{selected && <button type="button" onClick={() => submit(selected)}>{text('play')}</button>}</footer>
      <div className="sr-only" role="log" aria-live="polite" aria-relevant="additions">{view.announcements.map((message, index) => <p key={index}>{message}</p>)}</div>
    </main>
  </>;
}
export function App() {
  const [play] = useState(createPlay);
  const view = useSyncExternalStore(play.subscribe, play.getSnapshot);
  useEffect(() => play.start(), [play]);
  return <TableScreen view={view} play={play.play} />;
}
