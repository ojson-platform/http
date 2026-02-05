# withLogger

## Overview

`withLogger` is a wrapper for `@ojson/http` clients that emits **structured** logs for
requests, responses and errors.

The wrapper is intentionally transport-agnostic: you provide a `logger` implementation
(pino/bunyan-like), and the wrapper calls `logger.info|warn|error(event, message)`.

## Key Concepts

- **Opt-in**: if `options.logger` is not provided, logging is disabled by default.
- **Conservative defaults**: bodies and headers are not logged unless explicitly enabled.
- **Redaction**: sensitive headers are redacted by default (authorization/cookie/etc).
- **Composition ordering matters**: depending on where `withLogger` is placed in `compose(...)`,
  it can log each retry attempt or only the final outcome.

## Installation

```ts
import {withLogger} from '@ojson/http';
```

## Basic Usage

```ts
import {compose, http, withLogger} from '@ojson/http';

const logger = {
  info: (event: unknown, msg?: string) => console.log(msg, event),
  warn: (event: unknown, msg?: string) => console.warn(msg, event),
  error: (event: unknown, msg?: string) => console.error(msg, event),
};

const client = compose(
  http,
  withLogger({
    logger,
  }),
)({endpoint: 'https://api.example.com'});

await client.bind({}).request('GET /lists');
```

## Advanced Usage

### Include headers and bodies (not recommended by default)

```ts
import {compose, http, withLogger} from '@ojson/http';

const client = compose(
  http,
  withLogger({
    logger,
    include: {
      headers: true,
      requestBody: true,
      responseBody: true,
    },
    redact: {
      headers: true,
      paths: ['request.body.password', 'response.data.token'],
    },
  }),
)({endpoint: 'https://api.example.com'});
```

### Ordering with retries and timeouts

- Log **each retry attempt**:

```ts
compose(http, withLogger({logger}), withRetry({retries: 3}))
```

- Log **one entry for the whole operation** (including retries):

```ts
compose(http, withRetry({retries: 3}), withLogger({logger}))
```

## API Overview

- `withLogger(options?)` → `HttpWrapper`
  - `logger`: `LoggerLike` or `(ctx) => LoggerLike`
  - `enabled`: boolean or `(meta) => boolean`
  - `level`: minimal emitted level (`debug|info|warn|error`)
  - `include`: toggles for headers/bodies/start event/resolved URL
  - `redact`: header and path redaction

## Testing Notes

- Prefer mocking base `request()` to observe emitted events.
- Use fake timers to test `durationMs` deterministically.

## Best Practices

- Avoid logging request/response bodies unless necessary.
- Always redact sensitive headers and payload fields when enabling headers/bodies.

## See Also

- `src/with-retry/readme.md`
- `src/with-timeout/readme.md`
- `docs/readme-template.md`

