import { type AnalysisState } from './analysisHost';
import { useEffect, useMemo, useRef, useState } from 'react';
import { replay, exportPbn, exportRecordJson, SEATS, SUITS, type CompletedPlaythroughRecord } from '../table';
import { cardName, text } from '../explanation';
import { Card } from './Card';

export function ReviewScreen({ record, onBack, analysis, onTryAgain }: { onTryAgain?: () => void; analysis?: AnalysisState; record: CompletedPlaythroughRecord; onBack: () => void }) {
  // US-16.1, §4.3.5: replay also refuses incomplete records at runtime.
  const tricks = useMemo(() => replay(record), [record]);
  const [index, setIndex] = useState(0);
  const [showHands, setShowHands] = useState(() => window.matchMedia?.('(min-width:1000px)').matches ?? false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const trick = tricks[index];
  function download(format: 'json' | 'pbn') {
    const data = format === 'json' ? exportRecordJson(record) : exportPbn(record);
    const url = URL.createObjectURL(new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `bridgevibe.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="review-screen">
    <header className="review-header"><button type="button" onClick={onBack}>{text('review.back')}</button>
      <h1 ref={heading} tabIndex={-1}>{text('review.title')}</h1></header>
    <p role="note" className="review-xray"><span aria-hidden="true">▦</span>{text('review.xray')}</p>
    {analysis?.running && <p role="status" className="review-analysis-skeleton">{text('review.working')}</p>}
    {analysis?.abstention && <div className="review-unavailable">
      <p role="status">{analysis.abstention.text}</p>
      <button type="button" onClick={() => { heading.current?.focus(); onTryAgain?.(); }}>{text('review.try-again')}</button>
    </div>}
    <section className="review-replay" aria-label={text('review.replay')}>
      <div className="review-stepper">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label={text('review.previous')}>←</button>
        <div aria-live="polite"><h2>{text('review.position', { n: index + 1 })}</h2><p>{text('review.winner', { seat: text(`seat.${trick.winner}`) })}</p></div>
        <button type="button" disabled={index === 12} onClick={() => setIndex(index + 1)} aria-label={text('review.next')}>→</button>
      </div>
      {showHands && <p>{text('review.hands-at', { n: index + 1 })}</p>}
      <div className="review-layout" data-hands={showHands}>
        <ol className="review-plays">{trick.cards.map(({ seat, card }, offset) => {
          const badge = analysis?.costs.find(cost => cost.positionIndex === index * 4 + offset);
          return <li key={seat}><Card card={card} /><span>{text(`seat.${seat}`)}</span>
            {badge && <span className={`review-cost ${badge.cost ? 'review-cost-xray' : 'review-cost-neutral'}`}
              role="img" aria-label={badge.statement.text}>
              <b>{text(badge.cost ? 'review.cost-negative' : 'review.cost-zero', { cost: badge.cost })}</b>
              <small>{text('review.hindsight')}</small>
            </span>}</li>;
        })}</ol>
        {showHands && <section id="review-hands" className="review-hands" aria-label={text('review.hands-at', { n: index + 1 })}>
          {SEATS.map(seat => <section key={seat} className={`review-hand review-${seat}`} aria-label={text(`seat.${seat}`)}>
            <h3>{text(`seat.${seat}`)}</h3><div>{SUITS.map(suit => <p key={suit}>
              <span aria-hidden="true">{text(`symbol.${suit}`)}</span>
              {trick.hands[seat].filter(card => card.suit === suit).map(card => <span key={card.rank} role="img" aria-label={cardName(card)}>{text(`face.${card.rank}`)}</span>)}
            </p>)}</div>
          </section>)}
        </section>}
      </div>
      <button type="button" aria-expanded={showHands} onClick={() => setShowHands(!showHands)}>{text(showHands ? 'review.hide-hands' : 'review.hands')}</button>
    </section>
    <nav className="review-strip" aria-label={text('review.tricks')}>{tricks.map((_, n) => <button key={n} type="button"
      aria-label={text('review.trick', { n: n + 1 })} aria-current={n === index ? 'step' : undefined} onClick={() => setIndex(n)}>{text('review.number', { n: n + 1 })}</button>)}</nav>
    <div className="review-exports"><button type="button" onClick={() => download('json')}>{text('review.json')}</button>
      <button type="button" onClick={() => download('pbn')}>{text('review.pbn')}</button></div>
  </main>;
}
