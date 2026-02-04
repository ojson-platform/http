## 0007 Timeout mechanism vs withTimeout policy

Status: accepted  
Date: 2026-02-03

### Context

Timeout handling naturally spans multiple layers:

- the core request executor must convert a timeout into an abort signal, combine it with an external `AbortSignal`, and ensure timers are cleaned up
- higher-level code often needs policy: defaults, deadline clamping (`ctx.deadline`), and downstream propagation via headers

If timeout support is implemented only as a helper, every helper would need to
re-implement `AbortSignal` composition and timer cleanup, and standalone
`request()` calls would lose timeout support.

### Decision

Keep `RequestOptions.timeout` as a **core mechanism** implemented by `request()`.

- `request()` converts `timeout` to an internal timer-based abort signal
- if `options.signal` is present, `request()` combines it with the timeout signal
- timers are always cleaned up in `finally`

Provide `withTimeout` as a **policy layer**:

- apply default timeouts
- clamp effective timeout by `ctx.deadline`
- optionally propagate deadline information downstream via `deadlineHeader`

`withTimeout` does not replace `AbortSignal`. It sets/adjusts `options.timeout`
and may add headers.

### Example

```ts
import {compose, http, withTimeout} from '@ojson/http';

const client = compose(
  http,
  withTimeout({defaultTimeout: 5000}),
)({endpoint: 'https://api.example.com'});

await client.bind({deadline: Date.now() + 1000}).request('GET /lists', {
  signal: new AbortController().signal,
});
```

### Related code

- `src/client/request.ts` (timeout + signal composition + cleanup)
- `src/with-timeout/with-timeout.ts` (policy: defaults/clamping/header propagation)

### Consequences

- Timeout support is always available, including for standalone `request()` usage.
- Helpers can focus on policy rather than re-implementing abort/timer mechanics.
- A single implementation of signal composition reduces the risk of leaks and subtle abort bugs.

