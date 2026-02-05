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

### Why backoff and jitter

Without backoff, retries can hit the same failing service at the same time and make recovery harder. **Exponential backoff** increases the delay after each attempt (e.g. 1s, 2s, 4s), giving the downstream time to recover. **Jitter** adds randomness to that delay so many clients do not retry in sync (thundering herd). Use backoff whenever you retry on 5xx or 429; enable jitter when you have multiple clients. Linear backoff is an alternative when you prefer predictable spacing.

### Why retry budget

Without a budget, a single client can perform many retries and consume most of the capacity of a struggling service. A **retry budget** (token bucket) limits how many retries this client can use; successful requests refill tokens. Use a budget when you have many clients and want to protect the downstream; you can skip it for a single low-RPS client.

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

When enabled, the retry budget (token-bucket style) limits how many retries this client can use overall; successful requests refill tokens. See [ADR 0006 Retry budget](../../docs/ADR/0006-retry-budget.md) for the rationale.

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({retries: 3, budget: 'balanced'}),
)({endpoint: 'https://api.example.com'});
```

## API Overview

`withRetry(policy?)` returns an `HttpWrapper`. All options are optional; if `retries` is not set (and not overridden per request), the wrapper does not retry.

### policy.retries

Defines how many retries and with what delays.

| Type | Meaning |
|------|---------|
| `number` | Number of retries; delay schedule is generated from `backoff` (exponential or linear). |
| `number[]` | Explicit schedule: delay in seconds before each retry (e.g. `[1, 3, 10]` → wait 1s, then 3s, then 10s). |
| `string` | Shorthand: `"strategy,baseDelay,retries"`. Example: `"exp,1,3"` → 3 retries, exponential, base 1s. Allowed strategies: `exp`, `linear`. |

Can be overridden per request via `RequestOptions.retries`.

### policy.backoff

Used when `retries` is a `number` or a shorthand string. Ignored when `retries` is an array.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strategy` | `'exp' \| 'linear'` | `'exp'` | `exp`: delay = baseDelay × factor^(attempt−1); `linear`: delay = baseDelay × attempt. |
| `baseDelay` | `number` | `1` | Base delay in seconds (first retry). |
| `maxDelay` | `number` | `30` | Cap on delay in seconds. |
| `factor` | `number` | `2` | Multiplier for exponential backoff. |

### policy.jitter

Reduces synchronized retries by randomizing the delay.

| Type | Behavior |
|------|----------|
| `number` | Ratio in `[0, 1]`. Delay becomes `delay ± delay × jitter`. Default when not set: `0.2` (20%). |
| `(delaySeconds, attempt) => number` | Custom: given base delay and attempt index, return the actual delay in seconds. Invalid or negative return is ignored (original delay is used). |

### policy.budget

Optional retry budget (token bucket) shared per wrapper instance. Limits how many retries this client can spend; successful responses refill tokens.

| Value | Meaning |
|-------|---------|
| `undefined` or `'off'` | No budget (default). |
| `'conservative'` | Preset: few tokens, low refill. |
| `'balanced'` | Preset: moderate tokens and refill. |
| `'aggressive'` | Preset: more tokens and refill. |
| `"budget,maxTokens,refillOnSuccess,costPerRetry"` | Shorthand, e.g. `"budget,10,0.1,1"`. |
| `{ maxTokens, refillOnSuccess, costPerRetry }` | Object: same semantics. |

### policy.shouldRetry

Custom predicate: `(error: RequestError, meta: { route, attempt }) => boolean`. If provided, it replaces the default rule (retry on network errors, 429, 5xx). Return `true` to allow a retry.

### policy.allowNonIdempotent

When `true`, retries are also applied to non-idempotent methods (e.g. `POST`, `PATCH`). Default: `false` (only idempotent methods are retried).

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

