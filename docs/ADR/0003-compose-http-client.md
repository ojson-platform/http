## 0003 Compose for http client

Status: accepted  
Date: 2026-02-03

### Context

Client assembly needs a single composition entry point that keeps `ctx`
typing strict and the wrapper chain readable.

### Decision

Introduce `compose` for `@ojson/http`. It combines the base `http` factory
with a list of `HttpWrapper` functions. `compose` returns a client factory and
preserves `ctx` type across wrappers.

### Example

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(async ctx => ({headers: {authorization: `Bearer ${ctx.token}`}})),
)({endpoint: 'https://api.example.com'});
```

### Related code

- `src/compose.ts`

### Consequences

- A single entry point to assemble client + helpers.
- `ctx` type flows through `bind`.
- Docs and examples rely on the same composition model.
