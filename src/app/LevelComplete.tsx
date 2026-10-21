import { useEffect, useRef } from 'react';
import { text, type StringId } from '../explanation';

export function LevelComplete({ summary, onClose }: {
  summary: { rightFirstTime: number; afterANudge: number; skillTags: readonly string[] };
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // UX §10: announce the new screen and start keyboard navigation at its heading.
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="level-complete lesson-panel">
    <h1 tabIndex={-1} ref={heading}>{text('lesson.complete')}</h1>
    <p>{text('lesson.end')}</p>
    {summary.skillTags.map(skill => <p className="lesson-skill" key={skill}>
      {text('lesson.unlocked', { skill: text(`skill.${skill}` as StringId) })}
    </p>)}
    <dl className="lesson-counts">
      <div><dt>{text('lesson.first-time')}</dt><dd>{summary.rightFirstTime}</dd></div>
      <div><dt>{text('lesson.nudged')}</dt><dd>{summary.afterANudge}</dd></div>
    </dl>
    <button type="button" onClick={onClose}>{text('lesson.next-practice')}</button>
    <button type="button" onClick={onClose}>{text('lesson.enough')}</button>
    <p><small>{text('lesson.draft')}</small></p>
  </main>;
}
