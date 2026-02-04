## 0002 withAuth overrides previous strategy

Status: accepted  
Date: 2026-02-03

### Context

When `withAuth` is applied multiple times, multiple auth strategies can exist.
Stacking strategies complicates merge rules and may lead to conflicts.

### Decision

Each subsequent `withAuth` overrides the previous strategy. The client keeps
only the latest strategy (stored under a symbol).

### Example

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(async () => ({headers: {authorization: 'first'}})),
  withAuth(async () => ({headers: {authorization: 'second'}})),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('GET /lists');
```

### Related code

- `src/with-auth/with-auth.ts`

### Consequences

- Predictable behavior: the last strategy always wins.
- No implicit cascade of strategies or unclear merge order.
- Strategy chaining must be handled explicitly inside a strategy.
