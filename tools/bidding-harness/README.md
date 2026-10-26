# T5 harness configuration

Run with Node 24: `npm run bidding:harness -- --candidates <root> [--out <dir>]`.
The default output is `docs/reports/t5/`. It overwrites the three report files;
use a fresh output directory to preserve completed teacher grades.
No engines or dependencies are downloaded or built.

Checkouts default to the paths in `licences/candidates.json`, relative to `<root>`.
Checkout HEAD must match that register's full commit and tracked files must be clean.
pons builds instead attest their source commit in the build manifest; no checkout is required.
The pin is always printed; rbb's `--version` is printed alongside it. Build binaries
must come from those checkouts; the harness cannot establish binary/source identity.

Optional `<root>/bidding-harness.json` configures paths (absolute paths are allowed):

```json
{
  "rusty-bidding-bot": {
    "checkout": "candidates/rusty-bidding-bot",
    "binary": "target/release/rbb"
  },
  "saycbridge": {
    "checkout": "candidates/saycbridge",
    "python": "/path/to/venv/bin/python"
  },
  "Bridgit": {
    "command": { "executable": "t5-wrapper", "args": [] }
  },
  "pons": {
    "build": "builds/pons-bba-free",
    "command": { "executable": "t5-wrapper", "args": [] }
  }
}
```

Checkout/build paths are relative to the root; binary/Python paths are relative to
the checkout. Optional wrapper executables are relative to checkout (Bridgit) or
build (pons). No shell is used. A wrapper receives one final argument containing
an auction JSON object, with pons additionally receiving `profile: "american_instinct"`.
It must call the candidate's actual harness/API and print exactly one JSON object:

```json
{"call":"1C","ruleId":"opening-rule","explanation":"Opening clubs","provenance":"rule"}
```

This is a local wrapper contract, not a claim about an undocumented upstream CLI.
Use `provenance: "not-covered"` for an explicit uncovered result (`call` may be
null), or `"no-provenance"` when the engine supplies no rule evidence. Bridgit's
implicit passes must use `defaultPass: true`; they cannot be rule-backed even if
a wrapper supplies a rule ID. A nonempty rule ID and explicit `rule` provenance
are both required. Missing wrappers produce `not-run`, not synthetic calls.

pons is refused before any process runs unless its build contains `bba-free.json`:

```json
{
  "bbaFree": true,
  "commit": "c865f4a1e7e42c29ca9e6a6f9923ee5de34eda01",
  "excludedWeights": ["american_bba_*"]
}
```

The manifest attests to the actual build, not just the selected entry point.
Producing and verifying that build belongs to #34/T3; do not add a manifest to an
ordinary pons build. The executable must be inside that build. This gate checks
the attestation, not binary weight contents.

Each process has a 30-second timeout and 1 MiB stdout/stderr limit. Missing tools,
pin mismatches, process failures and malformed responses mark the entire candidate
`not-run` with a reason, retaining one blank result per auction. Uncovered results
are separate from unavailable engines. JSON retains statuses and reasons; CSV puts
not-run reasons in the explanation column. Grades and resolution notes stay empty.
The Python bridge is defensive but still needs verification against the real checkout.
