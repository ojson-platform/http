# Agent Guide – Helpers and Architecture

## Helper Modules

Helpers are wrappers around the base HTTP client. They add cross-cutting
behaviors (auth, retries, logging, tracing, defaults) while preserving the
core `endpoint`/`request` semantics.

Implemented helpers live under `src/with-*` and are exported from `src/index.ts`.

### Implemented helpers

- `withAuth` – resolve auth data from `ctx` and enrich request options.
  See ADR: `docs/ADR/0002-withauth-override.md`.
- `withTimeout` – default timeouts, deadline clamping (`ctx.deadline`), optional deadline propagation header.
  See ADR: `docs/ADR/0007-timeout-mechanism-vs-policy.md`.
- `withRetry` – retry policies with backoff/jitter and optional retry budget.
  See ADR: `docs/ADR/0006-retry-budget.md`.
- `withTracing` – correlation id propagation (e.g. `x-request-id`) resolved via `getId(ctx)`.

### Helper module structure

Follow the established helper module structure:

```
src/with-*/ 
├── index.ts       # Exports
├── types.ts       # Public types
├── with-*.ts      # Core implementation
└── utils.ts       # Pure helper functions (no side effects)
```

### Public types in `types.ts`

- All public helper types must live in `types.ts`.
- `index.ts` should:
  - `export type * from './types';`
  - re-export the wrapper implementation (e.g. `export {withRetry} from './with-retry';`).

### Module boundaries

Modules must respect strict boundaries:

- import from module roots only (via `index.ts`),
- do not import internal files from other modules.

This keeps APIs stable and prevents accidental coupling.

### Merge rules (for wrappers)

Wrappers must follow the core merge rules:

- immutable merge,
- lowercase header keys,
- remove `undefined` before merge,
- deep-merge nested objects.

### Wrapper implementation notes

- Wrappers typically wrap `bind()` to keep `ctx` available for request-time logic.
  This is why `bind(ctx, config?)` is mandatory at the public boundary.
- Wrappers should avoid creating per-request closures when possible; prefer
  shared methods + symbol-based internal state on bound clients when it improves
  performance without leaking public API surface.

### Test access to internals

If a wrapper needs test-time access to internals, expose a focused helper
function (read-only) rather than exporting internal symbols.
