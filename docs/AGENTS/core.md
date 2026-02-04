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

`http(options)` creates a base client bound to an endpoint and optional default
configuration. The client exposes:

- `endpoint(route, options)` – build a request descriptor.
- `request(route, options)` – execute a request using `fetch`.
- `bind(ctx, config)` – return a new client bound to context/config.

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
- precedence is: `withDefaults` → `bind(config)` → `request(options)`.

## Architecture Notes (Core)

- `endpoint()` must not have side effects.
- `request()` must not keep global state.
- `bind()` should return independent instances (no shared mutable config).
- All public APIs must be documented with JSDoc.
