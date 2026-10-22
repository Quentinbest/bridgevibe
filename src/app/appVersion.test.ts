import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { fixedDeal } from './fixture';
import { createPlay } from './play';
import { APP_VERSION } from './appVersion';

// #49: the injected version is package.json's, and records and F5 exports carry it.
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test('APP_VERSION is the package version injected at build time', () => {
  expect(APP_VERSION).toBe(version);
});

test('a practice record and the F5 provenance export carry the injected version', () => {
  vi.useFakeTimers();
  try {
    const play = createPlay({}, fixedDeal); const stop = play.start();
    vi.advanceTimersByTime(3000);
    play.chooseContract({ kind: 'choose-contract', strain: 'no-trumps', objective: 'game' });
    expect(play.record().appVersion).toBe(APP_VERSION);
    expect(play.provenanceLog.export().appVersion).toBe(APP_VERSION);
    stop();
  } finally { vi.useRealTimers(); }
});

test('app source never hard-codes a version literal', () => {
  const dir = new URL('./', import.meta.url);
  const offenders = readdirSync(dir).filter(name => /\.tsx?$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx'))
    .filter(name => /(?:appVersion:\s*|createProvenanceLog\()\s*['"]\d+\.\d+\.\d+['"]/.test(readFileSync(new URL(name, dir), 'utf8')));
  expect(offenders).toEqual([]);
});
