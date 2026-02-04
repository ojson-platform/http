## 0005 Support multi-value headers

Status: accepted  
Date: 2026-02-03

### Context

Some headers (notably `set-cookie`) must preserve multiple values. A single
string representation can lose semantics. Octokit normalizes headers to a
string map and converts values via `String(value)`, which drops multi-value
information.

### Decision

Support multi-value headers in `@ojson/http` by representing header values as
`string | string[]`. Merge logic preserves arrays, and `set-cookie` always
accumulates values.

### Example

```ts
const headers = [
  ['set-cookie', 'a=1; Path=/'],
  ['set-cookie', 'b=2; Path=/'],
];
```

### Related code

- `src/types.ts`
- `src/utils.ts`
- `src/client/request.ts`

### Consequences

- `headers` types become `string | string[]`.
- Request initialization expands header arrays into multiple entries.
- Response headers can preserve multi-value semantics.
