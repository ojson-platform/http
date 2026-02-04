# withRetry

## Overview

`withRetry` is a wrapper for `@ojson/http` clients that retries failed requests
according to a configured retry policy.

It is designed to be composed via `compose` and does not change the public
client interface.

## Key Concepts

- **Retry schedule**: `number[]` (explicit delays in seconds), `number` (count + backoff), or shorthand string like `exp,1,3`.
- **Idempotency guard**: retries are applied only to idempotent methods by default.
- **Jitter**: randomization to reduce synchronized retries across clients.
- **Retry-After**: server-provided delay for 429/503 responses.
- **Retry budget**: optional token-bucket budget shared per wrapper instance.

### Default behavior

- **Disabled by default**: if `policy.retries` is not set (and `RequestOptions.retries` is not set), the wrapper behaves as a no-op.
- **Idempotency guard**: retries apply only to idempotent methods (`GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS`, `TRACE`).
  - To disable the guard, set `allowNonIdempotent: true`.
- **Per-request overrides**: you can override the wrapper schedule per call via `RequestOptions.retries`.
- **Retryable errors (default)**:
  - network errors (no `status`)
  - `429`
  - `5xx`
- **Jitter (default)**: `0.2` (20%).
- **Retry-After**: if `Retry-After` is present on `429` or `503`, it is used as the next delay.
- **Budget (default)**: disabled (`budget` is `undefined` or `off`).

## Installation

```ts
import {withRetry} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({retries: [1, 3, 10]}),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('GET /lists');
```

## Advanced Usage

### Shorthand schedule

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({retries: 'exp,1,3'}),
)({endpoint: 'https://api.example.com'});
```

### Disabling the idempotency guard

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({retries: 2, allowNonIdempotent: true}),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('POST /lists', {body: {name: 'todo'}});
```

### Retry budget

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({retries: 3, budget: 'balanced'}),
)({endpoint: 'https://api.example.com'});
```

## API Overview

- `withRetry(policy?)` → `HttpWrapper`
  - **policy.retries**: `number | number[] | string`
  - **policy.backoff**: `{ strategy, baseDelay, maxDelay, factor }`
  - **policy.jitter**: `number | (delaySeconds, attempt) => number`
  - **policy.budget**: preset, shorthand, or config object
  - **policy.shouldRetry**: custom predicate
  - **policy.allowNonIdempotent**: retry non-idempotent methods

## Testing Notes

- Unit tests live in `src/with-retry/with-retry.spec.ts` (Vitest).
- Key scenarios: schedule, idempotency, abort behavior, retry-after, jitter bounds, budget limiting.

## Best Practices

- Prefer retrying idempotent methods only.
- Enable jitter to reduce thundering herd behavior.
- Consider enabling a budget in distributed systems to protect downstream services.

## See Also

- `src/with-timeout/readme.md` (deadline clamping and deadline header propagation)
- `src/with-auth/readme.md` (ctx-driven auth option enrichment)

