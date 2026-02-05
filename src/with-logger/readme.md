# withLogger

## Overview

`withLogger` is a wrapper for `@ojson/http` clients that emits **structured** logs for
requests, responses and errors.

The wrapper is intentionally transport-agnostic: you provide a `logger` implementation
(pino/bunyan-like), and the wrapper calls `logger.info|warn|error(event, message)`.
Errors thrown inside the logger are **never** propagated to the caller; the request
still completes or fails based on the underlying client only.

## Key Concepts

- **Opt-in**: if `options.logger` is not provided, logging is disabled by default.
- **Conservative defaults**: bodies and headers are not logged unless explicitly enabled.
- **Redaction**: sensitive headers are redacted by default (authorization/cookie/etc).
- **Composition ordering matters**: depending on where `withLogger` is placed in `compose(...)`,
  it can log each retry attempt or only the final outcome. See [withRetry](../with-retry/readme.md) and [withTimeout](../with-timeout/readme.md) for how ordering affects behavior.

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

- Log **each retry attempt** (logger wraps [withRetry](../with-retry/readme.md)):

```ts
compose(http, withLogger({logger}), withRetry({retries: 3}))
```

- Log **one entry for the whole operation** (including retries):

```ts
compose(http, withRetry({retries: 3}), withLogger({logger}))
```

Ordering with [withTimeout](../with-timeout/readme.md) matters if you want the logged timeout to reflect the effective timeout computed by the wrapper (place logger before withTimeout so it sees the merged options).

## API Overview

`withLogger(options?)` returns an `HttpWrapper`. All options are optional. If `logger` is not provided, logging is disabled (no events emitted).

### options.logger

Logger implementation. Compatible with pino/bunyan-like interfaces: methods `debug`, `info`, `warn`, `error` with signature `(event: unknown, message?: string) => void`. Missing levels are no-op.

| Type | Behavior |
|------|----------|
| omitted | Logging disabled. |
| `LoggerLike` | Same logger for all requests. |
| `(ctx) => LoggerLike \| undefined` | Resolve logger per request from bind context; `undefined` disables logging for that request. |

### options.enabled

Whether to emit logs for a given request. Default: `true` when `logger` is set, otherwise `false`.

| Type | Behavior |
|------|----------|
| `boolean` | Global on/off. |
| `(meta: { ctx, route, options }) => boolean` | Per-request: return `false` to skip logging for that call. |

### options.level

Minimal level to emit. Events below this level are not sent. Default: `'info'`. Values: `'debug'`, `'info'`, `'warn'`, `'error'`.

### options.include

What to put into each log entry. Defaults are conservative (no headers/bodies by default).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requestStart` | `boolean` | `false` | Emit a `http.request` entry before executing the request (level: debug). |
| `responseSuccess` | `boolean` | `true` | Log successful responses (2xx/3xx). |
| `responseError` | `boolean` | `true` | Log errors (4xx, 5xx, network, abort). |
| `headers` | `boolean` | `false` | Include request/response headers (after redaction). |
| `requestBody` | `boolean` | `false` | Include request body (after redaction). |
| `responseBody` | `boolean` | `false` | Include response body (after redaction). |
| `resolvedUrl` | `boolean` | `true` | Include resolved URL (requires calling `endpoint()`; set `false` to avoid extra work). |

### options.redact

How to redact sensitive data in logged payloads. Default: enabled with a safe set of header names (e.g. `authorization`, `cookie`, `set-cookie`, `x-api-key`).

| Value | Meaning |
|-------|---------|
| `false` | No redaction. |
| `{ headers?, paths?, replace? }` | **headers**: `true` (use default list) or `string[]` of header names (case-insensitive). **paths**: dot paths to redact in the event object, e.g. `['request.body.password', 'response.data.token']`. **replace**: string to use instead of redacted value (default: `'[REDACTED]'`). |

### options.mapLevel

Custom mapping from response/error to log level. Default: success → `info`, 4xx → `warn`, 5xx/network → `error`, AbortError → `warn`.

Signature: `(event: { kind: 'response' | 'error'; status?: number; error?: unknown }) => LogLevel`.

### options.baseFields

Extra key-value fields attached to every log entry (e.g. `service`, `env`). Merged into the event object before redaction.

### options.getFields

`(ctx) => Record<string, unknown> | undefined`. Extracts extra fields from the bind context (e.g. request id from `ctx`). Merged into the event object before redaction.

### options.maxStringLength

Maximum length for string values (bodies, error messages, stacks). Longer strings are truncated and suffixed with `…(truncated)`. Default: `8192`.

## Testing Notes

- Prefer mocking base `request()` to observe emitted events.
- Use fake timers to test `durationMs` deterministically.

## Best Practices

- Avoid logging request/response bodies unless necessary.
- Always redact sensitive headers and payload fields when enabling headers/bodies.

## See Also

- [withRetry](../with-retry/readme.md), [withTimeout](../with-timeout/readme.md)
- [docs/readme-template.md](../../docs/readme-template.md)

