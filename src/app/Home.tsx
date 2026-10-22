import { useEffect, useRef, type MouseEvent } from 'react';
import { fullFollowSuit } from '../curriculum/content';
import { text, type StringId } from '../explanation';
import { sessionAttempts } from '../progress/attemptStore';

// UX §1: a lesson takes 3–5 minutes. Provisional midpoint estimate, not lesson content data.
const PROVISIONAL_LESSON_DURATION_MINUTES = 4;

export function Home({ dealsPlayed, navigate }: { dealsPlayed: number; navigate: (search: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // UX §10: returning to Learn announces the screen and restores a useful keyboard starting point.
  useEffect(() => { heading.current?.focus(); }, []);
  const prompts = fullFollowSuit.exercises.flatMap(exercise => exercise.steps.flatMap(step => step.kind === 'prompt' ? [step.prompt] : []));
  // FR-P3, ADR-0004: count declared Prompts once, including Attempts on earlier content versions.
  const attempts = sessionAttempts.snapshot().filter(attempt => attempt.learnerId === 'session-learner');
  const done = prompts.filter(prompt => attempts.some(attempt => attempt.promptContentId === prompt.contentId)).length;
  const progress = text('home.steps', { done, total: prompts.length });
  const lessonUrl = '?lesson=follow-suit-full';
  function follow(event: MouseEvent<HTMLAnchorElement>, search: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(search);
  }
  return <div className="home-shell">
    <header className="home-brand"><h1 aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1></header>
    <main className="home-content">
      <h2 ref={heading} tabIndex={-1}>{text('home.next')}</h2>
      <a className="home-lesson" href={lessonUrl} onClick={event => follow(event, lessonUrl)}>
        {/* FR-P3: future lesson module/level slot; render only when Lesson declares that metadata. */}
        {fullFollowSuit.skillTags.map(skill => <p className="home-skill" key={skill}>
          {text('home.skill', { skill: text(`skill.${skill}` as StringId) })}
        </p>)}
        <h3 id="home-lesson-title">{text(fullFollowSuit.titleRef as StringId)}</h3>
        <p>{text('home.lesson-description')}</p>
        <progress aria-label={text('home.progress')} value={done} max={prompts.length} aria-valuetext={progress} />
        <p>{progress}</p>
        <p>{text('home.time', { minutes: Math.ceil(PROVISIONAL_LESSON_DURATION_MINUTES * (prompts.length - done) / prompts.length) })}</p>
        <span className="home-start">{text('home.open-lesson')}</span>
      </a>
      <a className="home-practice" href="?practice=1" onClick={event => follow(event, '?practice=1')}>
        <h3>{text('home.quick')}</h3><p>{text('home.practice-description')}</p>
      </a>
      <p className="home-session">{text(dealsPlayed === 1 ? 'home.session-one' : 'home.session', { count: dealsPlayed })} {text('home.unsaved')}</p>
    </main>
    {/* UX §2.1: only destinations with phase V content are offered. */}
    <nav className="home-nav" aria-label={text('home.navigation')}>
      {/* UX §2.3: this landing is Learn itself, so its tab stays here; the lesson card starts the lesson. */}
      <a href="./" aria-current="page" onClick={event => follow(event, '')}>{text('home.learn')}</a>
      <a href="?practice=1" onClick={event => follow(event, '?practice=1')}>{text('home.practice')}</a>
    </nav>
  </div>;
}
