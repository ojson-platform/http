# Agent Guide – Core Concepts

## Project Overview

This is a TypeScript library that provides a composable HTTP client core.
The core concept is **separating request construction from execution** while
keeping configuration merge rules explicit and deterministic.

## Setup Commands

- Install dependencies: `npm install`
- Build: `npm run build`
- Run tests: `npm test`

## Core Concepts

### Client Factory (`http`)

`http(options)` creates a base client (factory output). To ensure `ctx` is always
available to wrappers, the base client only exposes:

- `bind(ctx, config?)` – return a new client bound to context/config.

See ADR: `docs/ADR/0001-require-bind.md`.

### Bound Client (`client.bind(ctx, config)`)

`bind()` returns a **bound client** which exposes:

- `endpoint(route, options?)` – build a request descriptor (pure).
- `request(route, options?)` – execute a request using `fetch`.

### Endpoint Construction (`endpoint`)

`endpoint()` is pure and synchronous. It:

- applies `params` into `{param}` segments in the path,
- serializes `query` into the URL query string,
- encodes `body` as JSON and sets `content-type: application/json`,
- uses `data` as a raw body override (no JSON encoding).

### Request Execution (`request`)

`request()` performs the HTTP call using `fetch`:

- resolves the final URL using `baseUrl` + route,
- sets request method/headers/body,
- parses the response body as JSON when possible,
- throws a consistent `RequestError` for non-2xx responses and network failures,
- propagates `AbortError` without wrapping.

### Configuration Merge

Configuration merges are immutable and deterministic:

- headers are normalized to lowercase,
- `undefined` values are removed before merge,
- nested objects are deep-merged,
- precedence is: `request(options)` overrides `bind(config)` overrides config from `http(options)`. (Note: `withDefaults` is not implemented yet; when it is, it would sit at the base of this chain.)

See ADRs:

- `docs/ADR/0005-multi-value-headers.md` (multi-value headers)
- `docs/ADR/0007-timeout-mechanism-vs-policy.md` (timeout vs policy)

### Composition (`compose`)

The recommended extensibility mechanism is functional composition:

- `compose(http, withAuth(...), withTimeout(...), withRetry(...), withTracing(...))`

Wrappers must preserve the core semantics while enriching behavior.
See ADR: `docs/ADR/0003-compose-http-client.md`.

## Architecture Notes (Core)

- `endpoint()` must not have side effects.
- `request()` must not keep global state.
- `bind()` should return independent instances (no shared mutable config).
- All public APIs must be documented with JSDoc.
