import { useEffect, useRef, useState } from 'react';
import { SUITS, OBJECTIVES, trickTarget, sideOf, type ContractChoice, type SetupSeatView } from '../table';
import { text } from '../explanation';
import { Hand } from './Hand';

export function MiniBridgeSetup({ view, choose }: { view: SetupSeatView; choose: (choice: ContractChoice) => void }) {
  const [strain, setStrain] = useState<ContractChoice['strain']>('no-trumps');
  const [objective, setObjective] = useState<ContractChoice['objective']>('part-score');
  const first = useRef<HTMLButtonElement>(null);
  const learner = view.declarer && sideOf(view.declarer) === 'northSouth';
  useEffect(() => { if (view.step === 'contract-choice' && learner) first.current?.focus(); }, [view.step, learner]);
  const ns = view.announcements.filter(a => sideOf(a.seat) === 'northSouth').reduce((n, a) => n + a.hcp, 0);
  return <main className="setup-screen">
    <h2>{text('setup.title')}</h2>
    <div aria-live="polite" aria-atomic="true">
      <ol className="setup-points">{view.announcements.map(a => <li key={a.seat} className={a.seat === view.declarer ? 'setup-declarer' : undefined}>{text('setup.points', { seat: text(`seat.${a.seat}`), hcp: a.hcp })}</li>)}</ol>
      {view.step === 'redeal' && <p>{text('setup.redeal')}</p>}
      {/* US-06.2: the last seed index has no next Deal; New deal starts a fresh seed. */}
      {view.step === 'redeal-unavailable' && <p role="status">{text('setup.redeal-unavailable')}</p>}
      {view.declarer && <><p>{text('setup.totals', { ns, ew: 40 - ns })}</p><p>{text(view.tied ? 'setup.tie' : 'setup.declarer', { seat: text(`seat.${view.declarer}`) })}</p></>}
    </div>
    {view.dummy && view.dummySeat && <section className={`setup-dummy setup-${view.dummySeat}`} aria-label={text(`seat.${view.dummySeat}`)}>
      <p>{text('setup.dummy', { seat: text(`seat.${view.dummySeat}`) })}</p>
      <Hand cards={view.dummy} active={false} legalCards={[]} selected={null} onSelect={() => {}} onPlay={() => {}} />
    </section>}
    {view.step === 'contract-choice' && (learner ? <section aria-label={text('setup.choice')}>
      <fieldset><legend>{text('setup.strain')}</legend>{[...SUITS, 'no-trumps' as const].map((value, i) => <button ref={i === 0 ? first : undefined} key={value} type="button" aria-pressed={strain === value} onClick={() => setStrain(value)}>{text(value === 'no-trumps' ? 'strain.no-trumps' : `suit.${value}`)}</button>)}</fieldset>
      <fieldset><legend>{text('setup.objective')}</legend>{OBJECTIVES.map(value => <button key={value} type="button" aria-pressed={objective === value} onClick={() => setObjective(value)}>{text(`setup.${value}`, { target: trickTarget(strain, value) })}</button>)}</fieldset>
      <button type="button" onClick={() => choose({ kind: 'choose-contract', strain, objective })}>{text('setup.choose')}</button>
    </section> : <p>{text('setup.robot', { seat: text(`seat.${view.declarer!}`) })}</p>)}
    <section className="setup-own" aria-label={text(`seat.${view.seat}`)}><p>{text(`seat.${view.seat}`)}</p><Hand cards={view.hand} active={false} legalCards={[]} selected={null} onSelect={() => {}} onPlay={() => {}} /></section>
  </main>;
}
