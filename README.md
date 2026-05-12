# Lexshift

Lexshift is a toolkit for working with evolving AT Protocol lexicons. It helps you figure out which lexicon revision a record belongs to and migrate records between revisions when schemas change.

Full documentation is available at [lexshift.lou.gg](https://lexshift.lou.gg).

The project includes a reusable TypeScript library and an API-oriented workflow for integrating lexicon migration into apps and services. It focuses on practical schema evolution support: preserving compatible data, converting values when possible, and filling new fields with sensible defaults when needed.

## What Lexshift does

- **Identify revisions** by validating a record against the current lexicon and historical candidates.
- **Shift records across revisions** in either direction (upgrade or downgrade).
- **Handle schema drift** by detecting renamed, dropped, created, and type-changed fields.
- **Preserve data safely** with compatibility checks and controlled value conversion.

## Development

```bash
pnpm install
pnpm dev
```
