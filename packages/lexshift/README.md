# lexshift

`lexshift` helps you work with evolving AT Protocol lexicons by identifying record revisions and shifting records to a target revision.

It is designed for schema evolution workflows where records need to remain usable across multiple lexicon versions.

## Installation

```bash
npm install lexshift
```

## API overview

- `identify(record, options?)`: Detects which lexicon revision a record matches.
- `shift(record, targetRevision, options?)`: Migrates a record to a requested revision.

Both functions support a `historyProvider` option so you can supply historical lexicons when the current revision does not match.

## Example

```ts
import { identify, shift } from "lexshift";

const record = {
  $type: "com.example.profile",
  name: "Ada",
};

const historyProvider = async ({ nsid, current }) => {
  const previousLexicons = await fetchHistorySomehow(nsid, current.revision);
  return previousLexicons.map((candidate) => ({
    revision: candidate.revision,
    lexicon: candidate.lexicon,
    cid: candidate.cid,
  }));
};

const identified = await identify(record, { historyProvider });

const migrated = await shift(record, 3, { historyProvider });
```

## Notes

- `record.$type` must contain a valid NSID.
- If no matching revision is found, the functions throw an error.
