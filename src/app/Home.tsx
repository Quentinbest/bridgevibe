import { useEffect, useRef, type MouseEvent } from 'react';
import { fullFollowSuit } from '../curriculum/content';
import { catalogue, text, type StringId } from '../explanation';
import { sessionAttempts } from '../progress/attemptStore';

// UX §1: a lesson takes 3–5 minutes. Provisional midpoint estimate, not lesson content data.
const PROVISIONAL_LESSON_DURATION_MINUTES = 4;

// I-05, UX §8: fixed display order of endonyms, filtered to eligible locales (I18N-23.1: never mention en-XA in production code).
const LOCALE_ORDER = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'es'] as const;
const localeLabel = (tag: string) => {
  const key = `locale.name.${tag}` as StringId;
  return Object.hasOwn(catalogue, key) ? text(key) : tag;
};

export function Home({ dealsPlayed, navigate, locale = 'en', locales = ['en'], onLocaleChange }: {
  dealsPlayed: number; navigate: (search: string) => void;
  locale?: string; locales?: readonly string[]; onLocaleChange?: (tag: string) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // UX §10: returning to Learn announces the screen and restores a useful keyboard starting point.
  useEffect(() => { heading.current?.focus(); }, []);
  const prompts = fullFollowSuit.exercises.flatMap(exercise => exercise.steps.flatMap(step => step.kind === 'prompt' ? [step.prompt] : []));
  // FR-P3, ADR-0004: count declared Prompts once, including Attempts on earlier content versions.
  const attempts = sessionAttempts.snapshot().filter(attempt => attempt.learnerId === 'session-learner');
  const done = prompts.filter(prompt => attempts.some(attempt => attempt.promptContentId === prompt.contentId)).length;
  const progress = text('home.steps', { done, total: prompts.length });
  const lessonUrl = '?lesson=follow-suit-full';
  // Native URLs keep the page's other query context (e.g. ?debug=1), as SPA navigation does.
  function hrefFor(search: string) {
    const url = new URL(window.location.href);
    for (const key of ['lesson', 'seed', 'deal', 'practice']) url.searchParams.delete(key);
    new URLSearchParams(search).forEach((value, key) => url.searchParams.set(key, value));
    url.hash = '';
    return url.pathname + url.search;
  }
  function follow(event: MouseEvent<HTMLAnchorElement>, search: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(search);
  }
  const available = [...LOCALE_ORDER.filter(tag => locales.includes(tag)), ...locales.filter(tag => !(LOCALE_ORDER as readonly string[]).includes(tag))];
  return <div className="home-shell">
    <header className="home-brand">
      <h1 aria-label={text('product')}><span>{text('product.first')}</span><span className="wordmark-accent">{text('product.second')}</span></h1>
      {/* I18N-02, UX §8: endonym-only picker; hidden when only one locale is eligible (production today). */}
      {available.length > 1 && onLocaleChange && <select className="locale-picker" aria-label={text('locale.label')} value={locale} onChange={event => onLocaleChange(event.target.value)}>
        {available.map(tag => <option key={tag} value={tag} lang={tag}>{localeLabel(tag)}</option>)}
      </select>}
    </header>
    <main className="home-content">
      <h2 ref={heading} tabIndex={-1}>{text('home.next')}</h2>
      <a className="home-lesson" href={hrefFor(lessonUrl)} onClick={event => follow(event, lessonUrl)}>
        {fullFollowSuit.skillTags.map(skill => <p className="home-skill" key={skill}>
          {text('home.skill', { skill: text(`skill.${skill}` as StringId) })}
        </p>)}
        <h3 id="home-lesson-title">{text('home.level-title', { module: fullFollowSuit.module, title: text(fullFollowSuit.titleRef as StringId) })}</h3>
        <p>{text('home.lesson-description')}</p>
        <progress aria-label={text('home.progress')} value={done} max={prompts.length} aria-valuetext={progress} />
        <p>{progress}</p>
        <p>{text('home.time', { minutes: Math.ceil(PROVISIONAL_LESSON_DURATION_MINUTES * (prompts.length - done) / prompts.length) })}</p>
        <span className="home-start">{text('home.open-lesson')}</span>
      </a>
      <a className="home-practice" href={hrefFor('?practice=1')} onClick={event => follow(event, '?practice=1')}>
        <h3>{text('home.quick')}</h3><p>{text('home.practice-description')}</p>
      </a>
      <p className="home-session">{text('home.session', { count: dealsPlayed })} {text('home.unsaved')}</p>
    </main>
    {/* UX §2.1: only destinations with phase V content are offered. */}
    <nav className="home-nav" aria-label={text('home.navigation')}>
      {/* UX §2.3: this landing is Learn itself, so its tab stays here; the lesson card starts the lesson. */}
      {/* The current tab is a no-op: no history entry for the page already shown. */}
      <a href={hrefFor('')} aria-current="page" onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); heading.current?.focus(); } }}>{text('home.learn')}</a>
      <a href={hrefFor('?practice=1')} onClick={event => follow(event, '?practice=1')}>{text('home.practice')}</a>
    </nav>
  </div>;
}
