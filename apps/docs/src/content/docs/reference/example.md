---
title: API reference
description: Reference for the Lexshift identify and shift APIs.
---

Lexshift exposes two main functions:

- `identify(record, options?)` returns the lexicon revision a record matches.
- `shift(record, targetRevision, options?)` migrates a record to a different revision.

Both functions accept a `historyProvider` so you can supply older lexicons when the current revision does not match.

## `identify`

```ts
import { identify } from "lexshift";

const identified = await identify(record, {
  historyProvider: async ({ nsid, current }) => {
    return loadPreviousLexicons(nsid, current.revision).map((candidate) => ({
      revision: candidate.revision,
      lexicon: candidate.lexicon,
      cid: candidate.cid,
    }));
  },
});
```

`identify` returns the current revision when the record matches the latest lexicon, or the first matching historical revision when older lexicons are provided.

## `shift`

```ts
import { shift } from "lexshift";

const migrated = await shift(record, 5, {
  historyProvider: async ({ nsid, current }) => {
    return loadPreviousLexicons(nsid, current.revision).map((candidate) => ({
      revision: candidate.revision,
      lexicon: candidate.lexicon,
    }));
  },
});
```

`shift` first identifies the current revision, then applies the lexicon differences in order until the target revision is reached.

## Notes

- `record.$type` must be a valid NSID.
- If no matching revision is found, Lexshift throws an error.
- Records are preserved when fields stay compatible; otherwise Lexshift converts or fills values where possible.
