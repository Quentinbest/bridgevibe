# Font fixture

`plex-sans-sc-fixture.woff2` is a subset of the hinted, complete Regular face
from `@ibm/plex-sans-sc` version `1.1.0`, with the original IBM names and all
name IDs preserved. It is a test fixture, never shipped with the application.
It is under OFL-1.1; see `IBM-Plex-Sans-SC-LICENSE.txt` alongside it.

Source: https://registry.npmjs.org/@ibm/plex-sans-sc/-/plex-sans-sc-1.1.0.tgz

Integrity: `sha512-IkhORwgw/CrsUss7uW9Rj6KKSsGQoIyIaNWjjju/7sV7SYS3yk0c/DgZN/leIG3Co5lN/X4Or/sQaL+SdvmSIg==`

Reproduce after `npm run fonts:fetch -- --from .font-sources/tarballs`:

```sh
node scripts/fonts/make-fixture.ts
```

The fixture text is `继续红心ABC 0123`. The generator also extracts the source
licence from the hash-verified tarball, without executing package code.
