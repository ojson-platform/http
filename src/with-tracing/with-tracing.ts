import type {
  BoundHttpClient,
  HttpClient,
  HttpConfig,
  HttpWrapper,
  RequestOptions,
  RequestRoute,
} from '../types';
import type {TracingOptions} from './types';

import {mergeRequestOptions} from '../utils';

import {getHeaderName, safeGetId, withCorrelationIdHeader} from './utils';

const __WithTracing__ = Symbol('WithTracing');

type WithTracingClient = HttpClient & {
  [__WithTracing__]?: TracingOptions;
};

const wrapRequest = (request: BoundHttpClient['request'], ctx: unknown, opts: TracingOptions) =>
  async function (this: BoundHttpClient, route: RequestRoute, requestOptions?: RequestOptions) {
    const headerName = getHeaderName(opts);
    const id = await safeGetId(ctx, opts);

    let next = mergeRequestOptions(requestOptions ?? {}, {});
    next = withCorrelationIdHeader(next, headerName, id);

    return request.call(this, route, next);
  };

const wrapBind = (bind: HttpClient['bind']) =>
  function (this: WithTracingClient, ctx: unknown, config?: HttpConfig) {
    const bound = bind.call(this, ctx, config);
    const opts = this[__WithTracing__] ?? {};

    return {
      ...bound,
      request: wrapRequest(bound.request, ctx, opts),
    };
  };

/**
 * Add correlation id propagation to a client instance.
 *
 * - If `opts.getId` is provided and the correlation header is missing, it is resolved from `ctx`.
 *
 * The wrapper never overwrites an existing correlation header.
 */
export const withTracing =
  (opts: TracingOptions = {}): HttpWrapper =>
  (client: HttpClient): HttpClient => {
    const wrapped: WithTracingClient = {
      bind: __WithTracing__ in client ? client.bind : wrapBind(client.bind),
      [__WithTracing__]: opts,
    };

    return wrapped;
  };
