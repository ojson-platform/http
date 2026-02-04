# withAuth

## Overview

`withAuth` is a wrapper for `@ojson/http` clients that runs an auth strategy on
every request and merges its return value into request options.

The auth strategy receives `ctx` from `client.bind(ctx, ...)`, so it can use
context-bound credentials or services.

## Key Concepts

- **Auth strategy**: a function `(ctx) => RequestOptions | void | Promise<...>`.
- **Merge semantics**: auth options are merged on top of request options (auth wins on conflicts).
- **Override semantics**: if `withAuth` is applied multiple times, the last wrapper overrides the previous strategy.

## Installation

```ts
import {withAuth} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withAuth} from '@ojson/http';

type AuthCtx = {token: string};

const client = compose<AuthCtx>(
  http,
  withAuth(ctx => ({
    headers: {authorization: `Bearer ${ctx.token}`},
  })),
)({endpoint: 'https://api.example.com'});

await client.bind({token: 'secret'}).request('GET /lists');
```

## Advanced Usage

### Overriding a previously applied strategy

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(() => ({headers: {authorization: 'first'}})),
  withAuth(() => ({headers: {authorization: 'second'}})),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('GET /lists');
```

## API Overview

- `withAuth(strategy)` → `HttpWrapper`
  - **strategy**: `(ctx) => RequestOptions | void | Promise<...>`
  - **returns**: wrapper compatible with `compose`

## Testing Notes

- Unit tests live in `src/with-auth/with-auth.spec.ts` (Vitest).
- Key scenarios: ctx is passed, merge behavior, override behavior.

## Best Practices

- Keep strategies side-effect free; do I/O only when needed.
- Prefer short-lived tokens derived from `ctx` when possible.

## See Also

- `src/with-timeout/readme.md` (deadline / timeout propagation)

