# withTimeout

## Overview

`withTimeout` is a wrapper for `@ojson/http` clients that:

- applies a default `timeout` when none is provided by `bind`/`request`
- clamps the effective timeout by `ctx.deadline` (deadline clamping)
- optionally propagates deadline information downstream via a configurable header

## Key Concepts

- **Timeout**: `RequestOptions.timeout` is enforced by the core request implementation.
- **Deadline clamping**: when `ctx.deadline` is present, the effective timeout cannot exceed remaining time.
- **Header propagation**: downstream services can receive deadline info via a header (e.g. `x-timeout-ms`).

### Why propagate deadline

In a chain of calls (e.g. A → B → C), if the original request has a 2s timeout, each hop should know how much time is left so the whole path fits in 2s. **Deadline propagation** sends the deadline (or remaining time) in a request header; downstream can clamp its own timeout and optionally propagate further. Use it when you have multi-hop calls and care about end-to-end latency.

### Why clamp by deadline

If the caller has a deadline in 100 ms, starting a request with a 30 s timeout is pointless. **Deadline clamping** caps the effective timeout to the remaining time until the deadline so we do not start requests that cannot complete in time. Combined with fail-fast when the deadline is already past, this keeps behavior predictable. Use it whenever you have a request-scoped deadline (e.g. from an incoming HTTP request).

### Timeout: mechanism vs policy

The core `@ojson/http` request treats `RequestOptions.timeout` as a **mechanism**:
it is converted into an `AbortSignal`, combined with any external `signal`, and
timers are always cleaned up. There is no default timeout in the core.

`withTimeout` adds a **policy layer** on top:

- apply a default timeout when none is set
- clamp the effective timeout by `ctx.deadline`
- propagate deadline information downstream via a header

See [ADR 0007 Timeout mechanism vs policy](../../docs/ADR/0007-timeout-mechanism-vs-policy.md).

### Expired deadline (fail-fast)

When `ctx.deadline` is in the past or remaining time is non-positive, the wrapper does **not** perform the request: it throws immediately (fail-fast). This avoids sending a request that cannot complete within the allowed time.

## Installation

```ts
import {withTimeout} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withTimeout} from '@ojson/http';

const client = compose(
  http,
  withTimeout({defaultTimeout: 5000}),
)({endpoint: 'https://api.example.com'});

await client.bind({deadline: Date.now() + 1000}).request('GET /lists');
```

## Advanced Usage

### Deadline header propagation

```ts
import {compose, http, withTimeout} from '@ojson/http';

const client = compose(
  http,
  withTimeout({
    deadlineHeader: 'x-timeout-ms,relative-ms',
  }),
)({endpoint: 'https://api.example.com'});

await client.bind({deadline: Date.now() + 2500}).request('GET /lists');
```

### Respecting an existing header

```ts
import {compose, http, withTimeout} from '@ojson/http';

const client = compose(
  http,
  withTimeout({
    deadlineHeader: {
      name: 'x-timeout-ms',
      mode: 'relative-ms',
      respectExisting: true,
    },
  }),
)({endpoint: 'https://api.example.com'});

await client.bind({deadline: Date.now() + 2500}).request('GET /lists', {
  headers: {'x-timeout-ms': 'manual'},
});
```

## API Overview

- `withTimeout(number)` → `HttpWrapper`
  - shorthand for `{ defaultTimeout: number }`
- `withTimeout(options)` → `HttpWrapper`
  - `defaultTimeout`, `propagateDeadline`, `minTimeout`, `getDeadline`, `deadlineHeader`

## Testing Notes

- Unit tests live in `src/with-timeout/with-timeout.spec.ts` (Vitest).
- Key scenarios: default timeout, deadline clamping, fail-fast on expired deadline, header propagation.

## Best Practices

- Prefer a consistent header name across your services (e.g. `x-timeout-ms`).
- Use relative mode when downstream services also do clamping.
- Keep `minTimeout` small to avoid accidentally extending near-zero deadlines.

## See Also

- `src/with-auth/readme.md` (request option enrichment via ctx-driven strategy)

## References

- gRPC documentation on deadlines and cancellation: `https://grpc.io/docs/what-is-grpc/core-concepts/#deadlines`
- Envoy upstream request timeout: `https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/request_timeout`

