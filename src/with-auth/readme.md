# withAuth

## Overview

`withAuth` is a wrapper for `@ojson/http` clients that runs an auth strategy on
every request and merges its return value into request options.

The auth strategy receives `ctx` from `client.bind(ctx, ...)`, so it can use
context-bound credentials or services.

## Key Concepts

- **Auth strategy**: a function `(ctx) => RequestOptions | void | Promise<...>`. The strategy receives only `ctx` (no `route`, `options`, or `config`) so that auth is always bound to context; see [ADR 0001 Require bind](../../docs/ADR/0001-require-bind.md).
- **Merge semantics**: auth options are merged on top of request options (auth wins on conflicts).
- **Override semantics**: if `withAuth` is applied multiple times, the last wrapper overrides the previous strategy. See [ADR 0002 withAuth overrides](../../docs/ADR/0002-withauth-override.md).

## Installation

```ts
import {withAuth} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(ctx => ({
    headers: {authorization: `Bearer ${ctx.token}`},
  })),
)({endpoint: 'https://api.example.com'});

await client.bind({token: 'secret'}).request('GET /lists');
```

The `ctx` type is inferred from the strategy, so `ctx.token` and `bind({token: 'secret'})` are correctly typed.

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
- **Ordering with other wrappers:** place `withAuth` before [withLogger](../with-logger/readme.md) so auth headers are not logged; place it with or before [withRetry](../with-retry/readme.md) so each attempt gets correct auth; if the strategy uses `ctx.deadline` or timeouts, combine with [withTimeout](../with-timeout/readme.md).

## See Also

- [withTimeout](../with-timeout/readme.md) (deadline / timeout propagation)

