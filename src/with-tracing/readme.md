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

`withTracing(opts?)` returns an `HttpWrapper`. All options are optional. If the correlation header is already set on the request (e.g. by the caller), the wrapper never overwrites it.

### opts.headerName

Name of the request header used to send the correlation id. Default: `'x-request-id'`. The name is normalized to lowercase when comparing with existing headers, so existing headers are respected regardless of casing.

### opts.getId

Resolves the correlation id from the bind context. Called once per request when the header is missing.

| Aspect | Behavior |
|--------|----------|
| Signature | `(ctx: unknown) => string \| null \| undefined \| Promise<string \| null \| undefined>` — may be sync or async. |
| When header is set | If the return value is a non-empty string (after trim), that value is set as the header. |
| When header is not set | If `getId` is omitted, returns `null`/`undefined`, returns `''`, or returns a string that is empty after trim — the header is not added. |
| Errors | If `getId` throws or the returned promise rejects, the error is caught and the header is not set; the request proceeds without the correlation header. |

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

