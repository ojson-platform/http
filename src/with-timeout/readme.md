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

### Timeout: mechanism vs policy

The core `@ojson/http` request treats `RequestOptions.timeout` as a **mechanism**:
it is converted into an `AbortSignal`, combined with any external `signal`, and
timers are always cleaned up. There is no default timeout in the core.

`withTimeout` adds a **policy layer** on top:

- apply a default timeout when none is set
- clamp the effective timeout by `ctx.deadline`
- propagate deadline information downstream via a header

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

