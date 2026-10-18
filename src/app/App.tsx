import { SUITS } from '../table';
import { text } from '../explanation';
import { Card, CardBack } from './Card';
import { fixedDeal, display } from './fixture';

function Opponent({ seat }: { seat: 'west' | 'east' }) {
  return <section className={`opponent ${seat}`} aria-label={text(`seat.${seat}`)}>
    <div className="backs"><CardBack /><CardBack /><CardBack /></div>
    <p>{text('opponent', { seat: text(`seat.${seat}`), count: fixedDeal.hands[seat].length })}</p>
  </section>;
}
export function App() {
  return <>
    <header className="header"><h1 aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1></header>
    <main>
      <section className="status" aria-label={text('status')}>
        <span className="contract">{text(display.contract)}</span>
        <span>{text('declarer', { seat: text(`seat.${display.declarer}`) })}</span>
        <span className="tricks">{text('tricks', { won: display.tricksWon, target: display.target })}</span>
      </section>
      <section className="table" aria-label={text('table')}>
        <section className="dummy" aria-label={text('dummy')}>
          <p className="seat-label">{text('dummy')}</p>
          <div className="suit-columns">{SUITS.map(suit => <div className="suit-column" key={suit} data-suit={suit}>
            {fixedDeal.hands.north.filter(card => card.suit === suit).map(card => <Card key={card.rank} card={card} />)}
          </div>)}</div>
        </section>
        <Opponent seat="west" />
        <section className="trick-area" aria-label={text('trick.empty')}><div aria-hidden="true" /></section>
        <Opponent seat="east" />
        <section className="learner" aria-label={text('hand')}>
          <div className="hand">{SUITS.map(suit => <div className="hand-suit" key={suit}>
            {fixedDeal.hands.south.filter(card => card.suit === suit).map(card => <Card key={card.rank} card={card} />)}
          </div>)}</div>
          <p className="seat-label">{text('learner')}</p>
        </section>
      </section>
    </main>
  </>;
}
