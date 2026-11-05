import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); vi.resetModules(); });

test('I18N-15.2: the same seeded Playthrough has an identical completedRecord in English and a stub locale', async () => {
  async function run(locale: 'en' | 'es') {
    // I18N-15.2: fresh module state gives both runs the same process-local Playthrough ID.
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    const { catalogue, setLocale } = await import('../explanation');
    const { createPlay } = await import('./play');
    const { dealFromSeed } = await import('../table');
    setLocale(locale, locale === 'en' ? catalogue : { ...catalogue,
      'hint.forced-card': { ...catalogue['hint.forced-card'], text: 'Forzada: {card}' },
      'hint.not-covered': { ...catalogue['hint.not-covered'], text: 'Sin pista' },
      'announce.play': { ...catalogue['announce.play'], text: '{seat}: {card}' },
    });
    const play = createPlay({}, dealFromSeed('bv-issue-27', 1));
    const stop = play.start();
    for (let n = 0; n < 100 && play.getSnapshot().setup?.step !== 'contract-choice'; n++) vi.advanceTimersByTime(500);
    expect(play.getSnapshot().setup?.step).toBe('contract-choice');
    play.showHint();
    play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'part-score' });
    for (let n = 0; n < 200 && play.getSnapshot().status !== 'completed'; n++) {
      const view = play.getSnapshot();
      if (!view.collecting && view.legalCards.length && (view.turn === 'north' || view.turn === 'south')) {
        play.showHint(); play.play(view.turn, view.legalCards[0]);
      } else vi.advanceTimersByTime(1000);
    }
    const result = play.completedRecord(); stop();
    expect(play.provenanceLog.entries().filter(entry => entry.text).every(entry => entry.locale === locale)).toBe(true);
    return result;
  }
  const english = await run('en'), spanish = await run('es');
  // ADR-0001: the completion capability is a process-local symbol, not persisted Record data.
  expect(JSON.stringify(spanish)).toBe(JSON.stringify(english));
});
