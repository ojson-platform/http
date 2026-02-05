## README template for modules (`withAuth`, `withRetry`, etc.)

This template defines a common structure for module-level READMEs.
Modules can omit sections that are not relevant, but SHOULD keep the
order and naming for consistency.

1. **Title**
   - `# withAuth` / `# withTimeout` / `# withRetry` / `# withTracing` / ...

2. **Overview**
   - Short 1–2 paragraph description of what the helper does.
   - High-level positioning (composition with other helpers).
   - Mention whether it affects **request policy** (retries, timeout defaults) or is purely additive (headers, tracing).

3. **Key Concepts**
   - Core domain concepts specific to the module.
   - Typical subsections for `@ojson/http` helpers:
     - `bind(ctx, config?)` and why `ctx` is always available (if relevant)
     - `route` format (`"GET /path"`) and `RequestOptions` merge behavior
     - headers and multi-value headers (`string | string[]`) if the helper touches headers
     - timeout vs deadline (`ctx.deadline`) if the helper affects timing
     - retries, backoff, jitter, `Retry-After`, retry budget if the helper retries
     - correlation id header / resolver `getId(ctx)` if the helper traces

4. **Installation**
   - How to import the helper and required types/classes.
   - Short code snippet.
   - Prefer showing usage with `compose(http, withX(...))`.

5. **Basic Usage**
   - Step-by-step usage in simple scenarios.
   - For example (for most helpers):
     1. Create a wrapped client using `compose(http, withX(...))({endpoint: ...})`.
     2. Bind per-request context via `client.bind(ctx, config?)`.
     3. Call `bound.request(route, options?)`.

6. **Advanced Usage**
   - More complex patterns specific to the module:
     - interaction with other helpers (ordering and precedence)
     - configuration examples (recommended defaults and overrides)
     - edge cases and failure modes (AbortSignal, deadline exceeded, idempotency guard)
     - runtime environment notes (Node vs browser) if applicable

7. **API Overview**
   - High-level summary of the main public entry points:
     - `withX(opts?)` wrapper factory
     - important option types
     - any exported helpers/types that are part of the public contract
     - Important types if needed.
   - Each entry: short description, parameters, return type, small example.

8. **Testing Notes**
   - How this module is usually tested.
   - Recommended patterns:
     - mock base `request()` to observe merged options
     - use fake timers for time-based behavior (`withTimeout`, `withRetry`)
   - Key scenarios to cover (depends on helper):
     - header does/does not override existing values
     - `ctx` is used and propagated correctly
     - abort/deadline behavior
     - deterministic backoff/jitter bounds

9. **Best Practices** (optional but recommended)
   - Guidelines and common pitfalls for this module.
   - Mention safe defaults and how to disable/override them.

10. **See Also**
    - Links to related helpers (`withAuth`, `withTimeout`, `withRetry`, `withTracing`).
    - Links to relevant ADR(s) in `docs/ADR/`.
    - Prefer **inline** links to ADRs and related module readmes where the concept is first used, not only in See Also.


