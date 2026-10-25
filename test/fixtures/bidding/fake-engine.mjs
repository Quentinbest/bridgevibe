import assert from 'node:assert/strict';
const [mode, ...args] = process.argv.slice(2);
if (args[0] === '--version') {
  console.log('rbb 0.1.0-fixture');
} else if (mode === 'rbb') {
  assert.equal(args[0], 'call');
  assert.equal(args[args.indexOf('-v') + 1], 'None');
  assert.ok(args.includes('--json'));
  assert.ok(args[args.indexOf('--card') + 1].endsWith('cards/bbsa/SAYC.bbsa'));
  assert.ok(args[args.indexOf('--rules') + 1].endsWith('conventions'));
  assert.match(args[1], /^[AKQJT2-9.]+$/);
  const uncovered = args[args.indexOf('-a') + 1] === '1NT 2D';
  console.log(JSON.stringify({ call: uncovered ? 'P' : '1♣', explanation: uncovered ? 'No rule applies' : 'Opening, "clubs"',
    rule: uncovered ? null : { module: 'SAYC', file: 'opening.bid', line: 12 }, candidates: [] }));
} else if (mode === 'saycbridge') {
  assert.ok(args[0].endsWith('saycbridge_call.py'));
  assert.match(args[2], /^[AKQJT2-9.]+$/);
  console.log(JSON.stringify(args[3] === '1N 2D'
    ? { call: null, ruleId: null, explanation: null, provenance: 'not-covered' }
    : { call: '1N', ruleId: 'OneNotrumpOpening', explanation: 'Balanced opening', provenance: 'rule' }));
} else if (mode === 'Bridgit') {
  assert.ok(JSON.parse(args.at(-1)).hand);
  console.log(JSON.stringify({ call: 'Pass', ruleId: 'DefaultPass', defaultPass: true, provenance: 'rule' }));
} else if (mode === 'pons') {
  assert.equal(JSON.parse(args.at(-1)).profile, 'american_instinct');
  console.log(JSON.stringify({ call: 'Dbl', ruleId: 'takeout', explanation: null, provenance: 'rule' }));
} else if (mode === 'malformed') console.log('{broken');
else process.exit(2);
