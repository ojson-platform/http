## 0001 Require bind before request

Status: accepted  
Date: 2026-02-03

### Context

HTTP helpers (for example, `withAuth`) rely on `ctx` to prepare request options.
If `request` is allowed without `bind`, `ctx` can be missing or lost, which makes
the contract between helpers ambiguous.

### Decision

The base `http()` returns only `bind`. `request` and `endpoint` are exposed only
on `BoundHttpClient`, produced by `bind(ctx, config)`.

### Example

```ts
import {http} from '@ojson/http';

const client = http({endpoint: 'https://api.example.com'});
const bound = client.bind({requestId: 'req-1'});
await bound.request('GET /lists');
```

### Related code

- `src/client/http.ts`
- `src/client/bind.ts`

### Consequences

- `ctx` is always available to helpers.
- The API is explicit: no requests without `bind`.
- Helpers can rely on `ctx` without extra checks.
