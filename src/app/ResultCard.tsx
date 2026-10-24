import { useState, type Ref } from 'react';
import { miniBridgeResult, type CompletedPlaythroughRecord } from '../table';
import { text } from '../explanation';

// US-09.4: practice and review render the same Table Result and itemised Score.
export function ResultCard({ record, onReview, onNext, reviewRef, reference = false }: {
  record: CompletedPlaythroughRecord; onReview?: () => void; onNext?: () => void;
  reviewRef?: Ref<HTMLButtonElement>; reference?: boolean;
}) {
  const result = miniBridgeResult(record);
  const [expanded, setExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const score = result.score.score * (record.learnerSide === result.declaringSide ? 1 : -1);
  return <section className="result-card" aria-label={text('result.title')}>
    <h2>{text(!result.made ? result.short === 1 ? 'result.down-one' : 'result.down'
      : result.overtricks ? 'result.overtricks' : 'result.made', { count: result.short || result.overtricks })}</h2>
    <p className="result-contract">{text('result.contract', { objective: text(`objective.${result.objective}`),
      strain: text(result.contract.strain === 'no-trumps' ? 'result.no-trumps' : `suit.${result.contract.strain}`),
      seat: text(`seat.${result.declarer}`) })}</p>
    <p className="result-score">{text('result.score', { score: score > 0 ? `+${score}` : score,
      side: text(`result.${record.learnerSide}`) })}</p>
    <details onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary aria-expanded={expanded}>{text('result.breakdown')}</summary>
      <p>{text('result.perspective', { side: text(`result.${result.declaringSide}`) })}</p>
      <ul>{result.score.breakdown.map((item, index) => <li key={index}>{text(`result.item.${item.kind}`, {
        count: item.count, value: Math.abs(item.value), amount: Math.abs(item.amount),
      })}</li>)}</ul>
    </details>
    {reference && <details onToggle={event => setRulesExpanded(event.currentTarget.open)}>
      <summary aria-expanded={rulesExpanded}>{text('result.rules-title')}</summary>
      <p>{text('result.rules')}</p>
    </details>}
    {(onReview || onNext) && <div className="result-actions">
      {onReview && <button ref={reviewRef} type="button" onClick={onReview}>{text('result.review')}</button>}
      {onNext && <button type="button" onClick={onNext}>{text('result.next')}</button>}
    </div>}
  </section>;
}
