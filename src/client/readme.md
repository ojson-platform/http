# Client (core)

This directory contains the HTTP client core: `http()`, `bind()`, `endpoint()`, and `request()`.

- **`http(options)`** — creates a client that only exposes `bind(ctx, config?)`.
- **`bind(ctx, config?)`** — returns a bound client with `endpoint(route, options?)` and `request(route, options?)`.
- **`endpoint(route, options?)`** — builds a request descriptor (method, url, headers, body). Pure, synchronous.
- **`request(route, options?)`** — executes the request and returns response data or throws `RequestError` / `AbortError`.

Full documentation: [README](../../README.md) (Core Concepts, Request options, Errors). Rationale for requiring `bind`: [ADR 0001](../../docs/ADR/0001-require-bind.md).
