# @ojson/http

Composable HTTP client core for the ojson platform.

[![npm version](https://img.shields.io/npm/v/@ojson/http)](https://www.npmjs.com/package/@ojson/http)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ojson-platform_http&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=ojson-platform_http)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ojson-platform_http&metric=coverage)](https://sonarcloud.io/summary/new_code?id=ojson-platform_http)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ojson-platform_http&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=ojson-platform_http)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=ojson-platform_http&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=ojson-platform_http)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ojson-platform_http&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=ojson-platform_http)

## Overview

`@ojson/http` provides a minimal HTTP client core plus a set of composable helpers.
The design goal is a predictable request pipeline that can be used manually and
as a transport layer for higher-level generators (e.g. OpenAPI).

**Core principle**: call `client.bind(ctx, config)` first. A bound client has
all the methods needed to build and execute requests, and wrappers can rely on
`ctx` being available.

## Key Features

- **Composable wrappers**: extend behavior via `compose` and `with-*` helpers
- **Context-aware**: `ctx` is provided via `bind` and can be used by wrappers
- **Typed routes and options**: strict TypeScript types for request building/execution
- **Multi-value headers**: `headers` supports `string | string[]` (e.g. `set-cookie`)

## Stability patterns

In distributed systems, retries and timeouts can amplify failures if not tuned. This package offers optional patterns so you can choose what you need:

| Pattern | What | Why | Use when |
|--------|------|-----|----------|
| **Exponential backoff** | Delay between retries grows (e.g. 1s → 2s → 4s). | Gives downstream time to recover and reduces peak load. | You retry on 5xx/429 and want to avoid overwhelming the service. See [withRetry](./src/with-retry/readme.md). |
| **Jitter** | Random spread of the delay. | Avoids many clients retrying at the same time (thundering herd). | You have many clients with the same backoff. See [withRetry](./src/with-retry/readme.md). |
| **Retry budget** | Cap on how many retries this client can use (token bucket). | One client does not consume all retries; others get a share. | Many clients and limited downstream capacity. See [withRetry](./src/with-retry/readme.md#retry-budget). |
| **Deadline propagation** | Send deadline or remaining time in a header to the next service. | The whole chain (A → B → C) respects one SLA. | You have call chains and care about end-to-end latency. See [withTimeout](./src/with-timeout/readme.md). |
| **Deadline clamping** | Effective timeout never exceeds time left until deadline. | Do not start a request that cannot finish in time; fail fast. | You have a global deadline (e.g. from an incoming request). See [withTimeout](./src/with-timeout/readme.md). |

## Installation

```bash
npm install @ojson/http
```

## Quick Start

### Basic usage

Routes use the form `"METHOD /path"`; the path can include placeholders like `{id}` (filled via `options.params`). See [Request options (route + options)](#request-options-route--options) for the full list of options.

```ts
import {http} from '@ojson/http';

const client = http({
  endpoint: 'https://api.example.com',
});

const result = await client.bind({}).request('GET /lists', {
  query: {limit: 10},
});
```

## Core Concepts

### Binding (ctx + config)

`http(options)` returns a client with a single method: `bind(ctx, config)`. The
result of `bind` is a `BoundHttpClient` with:

- `bound.endpoint(route, options?)` → `{method, url, headers, body}` (build only)
- `bound.request(route, options?)` → `{status, url, headers, data}` (execute request)

`bind` is required before any request so that wrappers can rely on `ctx` being
available. See [ADR 0001](docs/ADR/0001-require-bind.md) for the rationale. For
timeout defaults and deadline propagation, see
[withTimeout](./src/with-timeout/readme.md).

### Standalone building/execution

You can use `endpoint(route, options)` and `request(route, options)` as
standalone functions (exported from `@ojson/http`) for tests or custom
pipelines; the recommended path is through a bound client. Types: `EndpointOptions`, `RequestOptions`, `EndpointResult`, `ResponseData` in `src/types.ts`.

### Request options (route + options)

**Route** is either a string `"METHOD /path"` or `{ method, url }`. The path
may contain placeholders `{name}`; they are replaced using `options.params`.

**Options** (second argument to `endpoint()` / `request()`) are typed as
`EndpointOptions` for building and `RequestOptions` for execution. Main fields:

| Option   | Type | Description |
|----------|------|-------------|
| `params` | `Record<string, string \| number>` | Replaces `{param}` in the path. Required if the path has placeholders. |
| `query`  | `Record<string, string \| number \| boolean \| ...[]>` | Serialized with `URLSearchParams` and appended to the URL. |
| `headers`| `HeadersInput` | Request headers. Multi-value supported as `string \| string[]` (e.g. `set-cookie`). |
| `body`   | `unknown` | JSON-encoded; sets `content-type: application/json`. |
| `data`   | `unknown` | Raw body; overrides `body` and does not set content-type. |
| `timeout`| `number` | Request timeout in ms (core turns it into an abort signal). |
| `signal` | `AbortSignal` | Optional abort signal, combined with timeout. |
| `retries`| `number \| number[] \| string` | **Requires [withRetry](./src/with-retry/readme.md).** Per-request retry schedule; ignored if client is not wrapped with `withRetry`. |

Full types: `EndpointOptions` and `RequestOptions` in `src/types.ts`.

**Options that require a wrapper:** Some fields in `RequestOptions` are only applied when the client is composed with the matching helper. Today: `retries` is used only by `withRetry`; without it, `retries` is passed through but has no effect. The same pattern can be used for future helpers (e.g. per-request overrides for caching or tracing).

Example with params and query:

```ts
await client.bind({}).request('GET /lists/{id}', {
  params: { id: '42' },
  query: { limit: 10 },
});
```

### Errors

The client throws:

- **`RequestError`** (from `@ojson/http`) when the request fails or the response status is ≥ 400. It has `status`, `request` (method, url, headers, body), and optionally `response` (status, url, headers, data). Useful for logging and retry logic.
- **`AbortError`** when the request is aborted (e.g. via `AbortSignal` or timeout). It is rethrown as-is and not wrapped.

See `RequestError` and `RequestErrorShape` in `src/types.ts` and `src/client/request.ts`.

## Composition

The client is designed to be wrapped via composition. Wrappers can intercept
`request`, merge options, and add behavior without mutating the base client.

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(async ctx => ({
    headers: {authorization: `Bearer ${ctx.token}`},
  })),
)({endpoint: 'https://api.example.com'});

await client.bind({token: 'secret'}).request('GET /lists');
```

The `ctx` type is inferred from the wrappers, so `bind({token: 'secret'})` and `ctx.token` are correctly typed.

## Modules

This package is organized into composable helpers. Use the link to open each module’s readme for details.

### [withAuth](./src/with-auth/readme.md)

Auth strategy wrapper that enriches request options based on `ctx`. **Use when:** you need to add auth (e.g. Bearer token, API key) from context on every request.

### [withTimeout](./src/with-timeout/readme.md)

Timeout defaults, deadline clamping (`ctx.deadline`), and optional deadline header propagation. **Use when:** you want a default timeout, or you have a request-level deadline and need fail-fast and/or to pass it downstream.

### [withTracing](./src/with-tracing/readme.md)

Correlation id propagation (`x-request-id`). **Use when:** you need a request/correlation id in headers for logging or tracing across services.

### [withLogger](./src/with-logger/readme.md)

Structured request/response/error logging with redaction. **Use when:** you want structured logs for outgoing requests and responses without leaking sensitive data.

### [withRetry](./src/with-retry/readme.md)

Retry policies with backoff, jitter, Retry-After, and optional retry budget. **Use when:** you want to retry on transient failures (5xx, 429, network errors) with controlled delays and optional budget.

## Configuration

Client creation and per-request config:

```ts
type HttpOptions = {
  endpoint: string;
  fetch?: FetchImpl;
  config?: HttpConfig;
};

type HttpConfig = {
  headers?: HeadersInput;
  timeout?: number;
};
```

**Configuration precedence:** options are merged so that **request(options)** overrides **bind(ctx, config)**, which overrides the **config** passed to `http(options)`. So the effective order is: base config from `http(options)` → then `bind(ctx, config)` → then per-call `request(route, options)`.

`HttpConfig` is merged into requests (e.g. from `bind(ctx, config)`). Header types and full option types are in `src/types.ts`.

## Architecture decisions

See `docs/ADR/README.md` for the list of accepted decisions.

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## License

ISC
