import { cardName, text } from '../explanation';
import type { DecisionAssessment, Verdict } from '../coach/decisionAssessment';
import { momentStatement } from '../coach/momentStatement';

const icons: Record<Verdict, string> = { sound: '✓', unlucky: '⚖', lucky: '↯', mistake: '↻' };
export function KeyMoments({ moments }: { moments: readonly DecisionAssessment[] }) {
  return <section className="key-moments" aria-labelledby="key-moments-heading">
    <h2 id="key-moments-heading">{moments.length === 1 ? text('moment.heading-one') : text('moment.heading', { count: moments.length })}</h2>
    <ol>{moments.map(moment => {
      const statement = momentStatement(moment)!;
      return <li key={moment.positionIndex} className="key-moment">
        <h3>{text('moment.position', { n: moment.trick, card: cardName(moment.card) })}</h3>
        <p className={`moment-badge moment-${moment.verdict}`}><span aria-hidden="true">{icons[moment.verdict!]}</span>{text(`moment.${moment.verdict!}`)}</p>
        <p>{text(statement.templateId)} <span className="moment-hindsight">{text('review.hindsight')}</span></p>
        {moment.alternative && <p>{text('moment.alternative', { card: cardName(moment.alternative) })}</p>}
        <p className="moment-outcome">{moment.outcome!.statement.text}</p>
      </li>;
    })}</ol>
  </section>;
}
