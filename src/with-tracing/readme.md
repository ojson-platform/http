# withTracing

## Overview

`withTracing` is a wrapper for `@ojson/http` clients that adds a correlation id
header (for log/metric correlation).

## Key Concepts

- **Correlation id**: a request id / trace id propagated via a configurable header (default: `x-request-id`).
- **Resolver**: `getId(ctx)` resolves the id from context (can be async).

## Installation

```ts
import {withTracing} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withTracing} from '@ojson/http';

const client = compose(
  http,
  withTracing({
    headerName: 'x-request-id',
    getId: ctx => (ctx as {requestId?: string}).requestId,
  }),
)({endpoint: 'https://api.example.com'});

await client.bind({requestId: 'req-1'}).request('GET /lists');
```

## Advanced Usage

### Using `withModels` to resolve the id

```ts
import type {Context, WithModels} from '@ojson/models';

import {compose, http, withTracing} from '@ojson/http';
import {SessionInfo} from '../models/SessionInfo';

export const baseHttpClient = compose(
  http,
  withTracing({
    async getId(ctx: WithModels<Context>) {
      const session = await ctx.request(SessionInfo).catch(() => null);
      return session?.id ?? null;
    },
  }),
);
```

## API Overview

- `withTracing(opts?)` → `HttpWrapper`
  - `headerName?: string` (default: `x-request-id`)
  - `getId?: (ctx) => string | null | undefined | Promise<...>`

## Testing Notes

- Unit tests live in `src/with-tracing/with-tracing.spec.ts` (Vitest).

## Best Practices

- Prefer resolving ids from request-scoped context (`ctx`) rather than global state.
- Do not overwrite correlation headers if they are already present.
- If you use OpenTelemetry auto-instrumentation, trace-context header injection should be handled by the transport instrumentation.

## See Also

- `src/with-timeout/readme.md` (deadline propagation and timeout clamping)
- `src/with-retry/readme.md` (retry policies)
- `src/with-auth/readme.md` (ctx-driven auth enrichment)

