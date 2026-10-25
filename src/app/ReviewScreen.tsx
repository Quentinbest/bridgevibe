import { reviewSampling } from './reviewSampling';
import { qualityTemplate, sampledQualityEntry } from '../coach/sampledQuality';
import type { DecisionAssessment } from '../coach/decisionAssessment';
import { uncertainQualityEntry } from '../coach/uncertainQuality';
import { momentLogEntries } from '../coach/momentStatement';
import type { createProvenanceLog } from '../coach/provenance';
import { assessDecisions, keyMoments } from '../coach/decisionAssessment';
import { KeyMoments } from './KeyMoments';
import { ResultCard } from './ResultCard';
import { type AnalysisState } from './analysisHost';
import { useEffect, useMemo, useRef, useState } from 'react';
import { replay, exportPbn, exportRecordJson, SEATS, SUITS, type CompletedPlaythroughRecord } from '../table';
import { cardName, text } from '../explanation';
import { Card } from './Card';
import { reviewSetup } from './reviewSetup';

export function ReviewScreen({ record, onBack, analysis, onTryAgain, provenanceLog }: { provenanceLog?: ReturnType<typeof createProvenanceLog>; onTryAgain?: () => void; analysis?: AnalysisState; record: CompletedPlaythroughRecord; onBack: () => void }) {
  // US-16.1, §4.3.5: replay also refuses incomplete records at runtime.
  const tricks = useMemo(() => replay(record), [record]);
  const initialDecisions = useMemo(() => assessDecisions(record, analysis?.costs ?? []), [record, analysis?.costs]);
  const [sampled, setSampled] = useState<{ record: CompletedPlaythroughRecord; decisions: DecisionAssessment[] }>();
  const decisions = sampled?.record === record ? sampled.decisions : initialDecisions;
  const sampling = !!analysis && !analysis.running && !analysis.abstention && sampled?.record !== record;
  useEffect(() => {
    if (!analysis || analysis.running || analysis.abstention) return;
    let active = true;
    void reviewSampling(record, initialDecisions, provenanceLog?.entries() ?? [], provenanceLog?.hiddenCardFound)
      .then(decisions => { if (active) setSampled({ record, decisions }); }, () => {
        if (active) setSampled({ record, decisions: initialDecisions });
      });
    return () => { active = false; };
  }, [record, initialDecisions, analysis, provenanceLog]);
  const moments = useMemo(() => keyMoments(decisions), [decisions]);
  // CI-5: log only displayed moments; stable IDs also deduplicate StrictMode and reopening review.
  useEffect(() => {
    if (!provenanceLog) return;
    const logged = new Set(provenanceLog.entries().map(entry => entry.id));
    for (const moment of moments) {
      const entries = momentLogEntries(moment, record.playthroughId, templateId => {
        const rendered = templateId === 'review.cost-description' ? moment.outcome!.statement.text!
          : text(templateId, { card: moment.alternative ? cardName(moment.alternative) : '' });
        return templateId === 'moment.alternative' || templateId === 'review.cost-description'
          ? rendered : `${rendered} ${text('review.hindsight')}`;
      });
      for (const entry of entries) if (!logged.has(entry.id)) { provenanceLog.record(entry); logged.add(entry.id); }
    }
  }, [moments, record.playthroughId, provenanceLog]);
  const setup = useMemo(() => reviewSetup(record), [record]);
  const [index, setIndex] = useState(0);
  const [showHands, setShowHands] = useState(() => window.matchMedia?.('(min-width:1000px)').matches ?? false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const setupPosition = setup[index];
  const trickIndex = index - setup.length;
  // CI-5: only the current trick's quality abstentions are actually displayed.
  useEffect(() => {
    if (!provenanceLog) return;
    const logged = new Set(provenanceLog.entries().map(entry => entry.id));
    for (const decision of decisions.filter(decision => (decision.trick === trickIndex + 1 && decision.quality === 'uncertain') || moments.includes(decision))) {
      const entry = sampledQualityEntry(decision, record.playthroughId, text(qualityTemplate(decision)))
        ?? uncertainQualityEntry(decision, record.playthroughId, text('moment.uncertain'));
      if (entry && !logged.has(entry.id)) { provenanceLog.record(entry); logged.add(entry.id); }
    }
  }, [decisions, moments, trickIndex, record.playthroughId, provenanceLog]);
  const trick = tricks[trickIndex];
  const hands = setupPosition ? record.deal.hands : trick.hands;
  // US-16.2: Previous is named by where it leads; from trick 1 it goes back a setup step.
  const previousLabel = text(setup.length && index <= setup.length ? 'review.previous-step' : 'review.previous');
  const handsLabel = setupPosition ? text('review.dealt-hands') : text('review.hands-at', { n: trickIndex + 1 });
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
    {record.gameFormat === 'minibridge' && <aside className="review-result"><ResultCard record={record} reference /></aside>}
    <p role="note" className="review-xray"><span aria-hidden="true">▦</span>{text('review.xray')}</p>
    {analysis?.running && <p role="status" className="review-analysis-skeleton">{text('review.working')}</p>}
    {sampling && <p role="status" className="review-analysis-skeleton">{text('review.sampling')}</p>}
    {analysis?.abstention && <div className="review-unavailable">
      <p role="status">{analysis.abstention.text}</p>
      <button type="button" onClick={() => { heading.current?.focus(); onTryAgain?.(); }}>{text('review.try-again')}</button>
    </div>}
    <KeyMoments moments={moments} />
    <section className="review-replay" aria-label={text(setup.length ? 'review.setup-replay' : 'review.replay')}>
      <div className="review-stepper">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label={previousLabel}>←</button>
        <div aria-live="polite" aria-atomic="true"><h2>{setupPosition?.title ?? text('review.position', { n: trickIndex + 1 })}</h2>
          {setupPosition ? setupPosition.lines.map((line, n) => <p key={n}>{line}</p>)
            : <p>{text('review.winner', { seat: text(`seat.${trick.winner}`) })}</p>}</div>
        <button type="button" disabled={index === setup.length + tricks.length - 1} onClick={() => setIndex(index + 1)} aria-label={text(setupPosition ? 'review.next-step' : 'review.next')}>→</button>
      </div>
      {showHands && <p>{handsLabel}</p>}
      <div className="review-layout" data-hands={showHands}>
        {trick && <ol className="review-plays">{trick.cards.map(({ seat, card }, offset) => {
          const badge = analysis?.costs.find(cost => cost.positionIndex === trickIndex * 4 + offset);
          const decision = decisions.find(d => d.positionIndex === badge?.positionIndex);
          return <li key={seat}><Card card={card} /><span>{text(`seat.${seat}`)}</span>
            {badge && <span className={`review-cost ${badge.cost ? 'review-cost-xray' : 'review-cost-neutral'}`}
              role="img" aria-label={badge.statement.text}>
              <b>{text(badge.cost ? 'review.cost-negative' : 'review.cost-zero', { cost: badge.cost })}</b>
              <small>{text('review.hindsight')}</small>
            </span>}
            {badge && decision?.quality === 'uncertain'
              && <small className="review-quality">{text(decision.sampling ? qualityTemplate(decision) : 'moment.uncertain')}</small>}</li>;
        })}</ol>}
        {showHands && <section id="review-hands" className="review-hands" aria-label={handsLabel}>
          {SEATS.map(seat => <section key={seat} className={`review-hand review-${seat}`} aria-label={text(`seat.${seat}`)}>
            <h3>{text(`seat.${seat}`)}</h3><div>{SUITS.map(suit => <p key={suit}>
              <span aria-hidden="true">{text(`symbol.${suit}`)}</span>
              {hands[seat].filter(card => card.suit === suit).map(card => <span key={card.rank} role="img" aria-label={cardName(card)}>{text(`face.${card.rank}`)}</span>)}
            </p>)}</div>
          </section>)}
        </section>}
      </div>
      <button type="button" aria-expanded={showHands} onClick={() => setShowHands(!showHands)}>{text(showHands ? 'review.hide-hands' : 'review.hands')}</button>
    </section>
    <nav className="review-strip" aria-label={text(setup.length ? 'review.steps' : 'review.tricks')}>
      {setup.map((position, n) => <button key={position.title} type="button" aria-current={n === index ? 'step' : undefined}
        onClick={() => setIndex(n)}>{position.title}</button>)}
      {tricks.map((_, n) => <button key={n} type="button"
        data-key-moment={moments.some(moment => moment.trick === n + 1) || undefined}
        aria-label={text(moments.some(moment => moment.trick === n + 1) ? 'moment.trick' : 'review.trick', { n: n + 1 })} aria-current={n === trickIndex ? 'step' : undefined} onClick={() => setIndex(setup.length + n)}>{text('review.number', { n: n + 1 })}</button>)}</nav>
    <div className="review-exports"><button type="button" onClick={() => download('json')}>{text('review.json')}</button>
      <button type="button" onClick={() => download('pbn')}>{text('review.pbn')}</button></div>
  </main>;
}
