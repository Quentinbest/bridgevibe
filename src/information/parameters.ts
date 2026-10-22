// U-02, US-18.3: provisional minimum; T2 will set the final count.
export const HINT_SAMPLE_COUNT = 50;
// U-01: provisional latency target.
export const HINT_DEADLINE_MS = 3000;
// §4.6.7: full confidence when all consistent layouts fit within this limit.
export const HINT_ENUMERATION_LIMIT = HINT_SAMPLE_COUNT;
// §4.6.7: skip enumeration in early positions with more than this many unconstrained layouts.
export const HINT_ENUMERATION_SEARCH_LIMIT = 100000;
// §4.6.7: cap partial assignments visited even when constraints make enumeration expensive.
export const HINT_ENUMERATION_WORK_LIMIT = 100000;
// §4.6.7: bounded rejection effort per sample, including impossible constraints.
export const HINT_MAX_TRIES = 20000;

export const sampler = { name: 'bv-layout', version: '1' } as const;
