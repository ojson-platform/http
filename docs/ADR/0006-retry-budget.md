## 0006 Add retry budget

Status: accepted  
Date: 2026-02-03

### Context

Retries are a common resilience mechanism, but in distributed systems they can
amplify load during partial outages:

- multiple clients retry at the same time (even with jitter, the aggregate load can be high)
- retries can shift pressure from a failing dependency into a full outage (thundering herd)
- non-critical paths can consume capacity needed for critical paths

We want a mechanism that allows retries, while limiting their global impact for
a given client instance.

### Decision

`withRetry` supports an optional **retry budget** (token-bucket style).

- Retrying consumes tokens.
- Successful requests refill tokens.
- If there are not enough tokens, retries are skipped (the last error is returned).
- The budget state is scoped to a wrapper instance (not global process state) and
  shared across requests for the same client.

Configuration is available via presets, shorthand, or explicit config:

- presets: `conservative`, `balanced`, `aggressive`
- shorthand: `budget,<maxTokens>,<refillOnSuccess>,<costPerRetry>`
- config object: `{ maxTokens, refillOnSuccess, costPerRetry }`

### Example

```ts
import {compose, http, withRetry} from '@ojson/http';

const client = compose(
  http,
  withRetry({
    retries: 3,
    budget: 'balanced',
  }),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('GET /lists');
```

### Related code

- `src/with-retry/with-retry.ts`
- `src/with-retry/utils.ts`
- `src/with-retry/types.ts`

### Consequences

- Retry behavior becomes more predictable under dependency failure.
- Prevents unlimited retry amplification within a single client instance.
- Budget parameters must be tuned per service (presets are only defaults).

