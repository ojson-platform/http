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

## Installation

```bash
npm install @ojson/http
```

## Quick Start

### Basic usage

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
available. For timeout defaults and deadline propagation, see
[withTimeout](./src/with-timeout/readme.md).

### Standalone building/execution

You can use `endpoint(route, options)` and `request(route, options)` as
standalone functions (exported from `@ojson/http`), but the recommended path is
through a bound client.

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
| `retries`| — | Used by [withRetry](./src/with-retry/readme.md). |

Full types: `EndpointOptions` and `RequestOptions` in `src/types.ts`.

Example with params and query:

```ts
await client.bind({}).request('GET /lists/{id}', {
  params: { id: '42' },
  query: { limit: 10 },
});
```

## Composition

The client is designed to be wrapped via composition. Wrappers can intercept
`request`, merge options, and add behavior without mutating the base client.

```ts
import {compose, http, withAuth} from '@ojson/http';

const client = compose(
  http,
  withAuth(async ctx => ({
    headers: {authorization: `Bearer ${ctx?.token ?? ''}`},
  })),
)({
  endpoint: 'https://api.example.com',
});

// ctx type is inferred from wrappers
type AuthCtx = {token: string};
const typed = compose<AuthCtx>(http, withAuth(async ctx => ({
  headers: {authorization: `Bearer ${ctx.token}`},
})))({endpoint: 'https://api.example.com'});

await typed.bind({token: 'secret'}).request('GET /lists');
```

## Modules

This package is organized into composable helpers:

### [withAuth](./src/with-auth/readme.md)

Auth strategy wrapper that enriches request options based on `ctx`.

### [withTimeout](./src/with-timeout/readme.md)

Timeout defaults, deadline clamping (`ctx.deadline`), and optional deadline header propagation.

### [withTracing](./src/with-tracing/readme.md)

Correlation id propagation (`x-request-id`).

### [withLogger](./src/with-logger/readme.md)

Structured request/response/error logging with redaction.

### [withRetry](./src/with-retry/readme.md)

Retry policies with backoff, jitter, Retry-After, and optional retry budget.

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

`HttpConfig` is merged into requests (e.g. from `bind(ctx, config)`). Header
types and full option types are in `src/types.ts`.

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
