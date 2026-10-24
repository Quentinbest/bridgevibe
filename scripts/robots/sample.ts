import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

// US-11, F7: Node runs the unchanged browser modules, as the content checker does.
if (import.meta.main) registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const base = new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(base.href + suffix);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

export async function generateSample(count = 20): Promise<string> {
  const { dealFromSeed, startMiniBridge, SEATS } = await import('../../src/table/index');
  const { principlesPolicy, contractChoicePolicy } = await import('../../src/robots/index');
  const lines = ['# F7 robot sample', '', 'Seed: `bv-principles-f7`; policy: `bv-principles` version `1`. Teacher review pending.', ''];
  for (let index = 0; index < count; index++) {
    const setup = startMiniBridge({ deal: dealFromSeed('bv-principles-f7', index + 1), learnerSide: 'northSouth' });
    while (setup.seatView('south').step !== 'contract-choice') setup.advance();
    const declarer = setup.seatView('south').declarer!;
    const choice = contractChoicePolicy.decide(setup.seatView(declarer));
    const controller = setup.controllerOf(declarer);
    const selected = setup.submit(declarer, controller, choice, controller === 'robot'
      ? { kind: 'robot', policy: contractChoicePolicy.name, version: contractChoicePolicy.version, ruleId: contractChoicePolicy.ruleId, durationMs: 0 } : undefined);
    if (selected.kind !== 'accepted') throw new Error('Sample contract rejected');
    const table = setup.playthrough()!, record = table.record();
    lines.push(`## Deal ${index + 1}: ${record.deal.dealId}`, '', `Declarer: ${declarer}; ${choice.strain}; ${choice.objective}.`, '');
    for (const seat of SEATS) lines.push(`- ${seat}: ${record.deal.hands[seat].map(c => `${c.suit}/${c.rank}`).join(' ')}`);
    lines.push('', '| Trick | Position | Seat | Card | Rule ID |', '| --- | --- | --- | --- | --- |');
    for (let n = 0; n < 52; n++) {
      const seat = table.seatView(declarer).turn!;
      const dummySeat = SEATS[(SEATS.indexOf(declarer) + 2) % 4];
      const view = table.seatView(seat === dummySeat ? declarer : seat);
      const decision = principlesPolicy.decide(view, 'f7', Infinity);
      const control = table.controllerOf(seat);
      const result = table.submit(seat, control, { kind: 'play-card', card: decision.card }, control === 'robot'
        ? { kind: 'robot', policy: principlesPolicy.name, version: principlesPolicy.version, ruleId: decision.ruleId, durationMs: 0 } : undefined);
      if (result.kind !== 'accepted' || !decision.ruleId) throw new Error(`Sample card rejected: ${index}/${n}`);
      lines.push(`| ${Math.floor(n / 4) + 1} | ${n % 4 + 1} | ${seat} | ${decision.card.suit}/${decision.card.rank} | ${decision.ruleId} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
if (import.meta.main) {
  const output = new URL('../../docs/reports/robot-sample.md', import.meta.url);
  mkdirSync(new URL('.', output), { recursive: true });
  writeFileSync(output, await generateSample());
}
