import type {
  BoundHttpClient,
  HttpClient,
  HttpConfig,
  HttpWrapper,
  RequestOptions,
  RequestRoute,
} from '../types';
import type {WithTimeoutArg, WithTimeoutOptions} from './types';

import {mergeRequestOptions} from '../utils';
import {
  asOptions,
  clampMin,
  computeTimeoutMs,
  createAbortError,
  DEFAULT_WITH_TIMEOUT_OPTIONS,
  parseDeadlineHeader,
  withDeadlineHeader,
} from './utils';

const __WithTimeout__ = Symbol('WithTimeout');

type WithTimeoutClient = HttpClient & {
  [__WithTimeout__]?: WithTimeoutOptions;
};

const wrapRequest =
  (request: BoundHttpClient['request'], ctx: unknown, options: WithTimeoutOptions) =>
  async function (this: BoundHttpClient, route: RequestRoute, requestOptions?: RequestOptions) {
    const resolved: WithTimeoutOptions = {...DEFAULT_WITH_TIMEOUT_OPTIONS, ...options};

    const computed = computeTimeoutMs(ctx, requestOptions, resolved);
    if (
      resolved.propagateDeadline &&
      computed.deadlineMs !== undefined &&
      computed.remainingMs !== undefined
    ) {
      if (computed.remainingMs <= 0) {
        throw createAbortError('Deadline exceeded');
      }
    }

    const nextTimeout = computed.timeout;
    let next = mergeRequestOptions(requestOptions ?? {}, nextTimeout === undefined ? {} : {timeout: nextTimeout});

    const headerConfig = resolved.deadlineHeader ? parseDeadlineHeader(resolved.deadlineHeader) : undefined;
    if (headerConfig && computed.deadlineMs !== undefined) {
      const remaining = clampMin(
        computed.deadlineMs - Date.now(),
        resolved.minTimeout ?? DEFAULT_WITH_TIMEOUT_OPTIONS.minTimeout,
      );
      next = withDeadlineHeader(next, computed.deadlineMs, remaining, headerConfig);
    }

    return request.call(this, route, next);
  };

const wrapBind = (bind: HttpClient['bind']) =>
  function (this: WithTimeoutClient, ctx: unknown, config?: HttpConfig) {
    const bound = bind.call(this, ctx, config);
    const options = this[__WithTimeout__] ?? {};

    return {
      ...bound,
      request: wrapRequest(bound.request, ctx, options),
    };
  };

/**
 * Add timeout and deadline propagation to a client instance.
 *
 * Semantics:
 * - Applies `defaultTimeout` when neither request nor bind set `timeout`.
 * - If `propagateDeadline` is enabled and `ctx.deadline` is present, the
 *   effective timeout is clamped by the remaining time to the deadline.
 * - If a `deadlineHeader` is configured, the wrapper adds a header to request
 *   options to propagate deadline information downstream.
 *
 * Note: this wrapper does not replace `AbortSignal`. It sets `options.timeout`,
 * and the core request implementation is responsible for combining timeout with
 * any external `signal`.
 *
 * ADR: docs/ADR/0001-require-bind.md
 *
 * @example
 * ```ts
 * import {compose, http, withTimeout} from '@ojson/http';
 *
 * const client = compose(
 *   http,
 *   withTimeout({
 *     defaultTimeout: 5000,
 *     deadlineHeader: 'x-timeout-ms,relative-ms',
 *   }),
 * )({endpoint: 'https://api.example.com'});
 *
 * await client.bind({deadline: Date.now() + 1000}).request('GET /lists');
 * ```
 */
export const withTimeout =
  (arg?: WithTimeoutArg): HttpWrapper =>
  (client: HttpClient): HttpClient => {
    const wrapped: WithTimeoutClient = {
      bind: __WithTimeout__ in client ? client.bind : wrapBind(client.bind),
      [__WithTimeout__]: asOptions(arg),
    };

    return wrapped;
  };

