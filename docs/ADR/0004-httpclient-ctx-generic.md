## 0004 HttpClient is generic over ctx

Status: accepted  
Date: 2026-02-03

### Context

`ctx` is used by helpers (for example, `withAuth`) and must be enforced at
compile time. Without a generic `HttpClient`, the `ctx` type is lost.

### Decision

`HttpClient` and `HttpWrapper` are parameterized by `CTX`. `bind` accepts
`ctx: CTX`, and `compose` keeps this type across the wrapper chain.

### Example

```ts
import {compose, http, withAuth} from '@ojson/http';

type AuthCtx = {token: string};

const client = compose<AuthCtx>(
  http,
  withAuth(async ctx => ({headers: {authorization: `Bearer ${ctx.token}`}})),
)({endpoint: 'https://api.example.com'});

client.bind({token: 'secret'});
```

### Related code

- `src/types.ts`
- `src/compose.ts`

### Consequences

- Strongly typed context for all `bind` calls.
- Helpers can require a concrete `ctx` type.
- Types and examples share a single source of truth for `ctx`.
