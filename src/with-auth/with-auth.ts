import type {
  BoundHttpClient,
  HttpClient,
  HttpConfig,
  HttpWrapper,
  RequestOptions,
  RequestRoute,
} from '../types';
import type {AuthStrategy} from './types';

import {mergeRequestOptions} from '../utils';

// ADR: docs/ADR/0002-withauth-override.md
const __AuthStrategy__ = Symbol('AuthStrategy');

type WithAuthClient<CTX> = HttpClient<CTX> & {
  [__AuthStrategy__]?: AuthStrategy<unknown>;
};

const wrapRequest = <CTX>(
  request: BoundHttpClient['request'],
  strategy: AuthStrategy<CTX>,
  ctx: CTX,
) =>
  async function (this: BoundHttpClient, route: RequestRoute, options?: RequestOptions) {
    const auth = await strategy(ctx as CTX);
    const next = mergeRequestOptions(options ?? {}, auth ?? {});
    return request.call(this, route, next);
  };

const wrapBind = <CTX>(bind: HttpClient<CTX>['bind']) =>
  function (this: WithAuthClient<CTX>, ctx: CTX, config?: HttpConfig) {
    const bound = bind.call(this, ctx, config);
    return {
      ...bound,
      request: wrapRequest(bound.request, this[__AuthStrategy__] as AuthStrategy<CTX>, ctx),
    };
  };

/**
 * Add auth strategy execution to a client instance.
 *
 * The strategy is executed on every request and its return value is merged on
 * top of request options (auth wins on conflicts).
 *
 * The strategy receives `ctx` provided via `client.bind(ctx, ...)`.
 *
 * If `withAuth` is applied multiple times, the last wrapper overrides the
 * previous strategy.
 *
 * @param strategy Strategy that returns auth-related request options.
 * @returns Wrapper function that adds auth to requests.
 *
 * ADR: docs/ADR/0002-withauth-override.md
 *
 * @example
 * ```ts
 * import {compose, http, withAuth} from '@ojson/http';
 *
 * type AuthCtx = {token: string};
 *
 * const client = compose<AuthCtx>(
 *   http,
 *   withAuth(ctx => ({headers: {authorization: `Bearer ${ctx.token}`}})),
 * )({endpoint: 'https://api.example.com'});
 *
 * await client.bind({token: 'secret'}).request('GET /lists');
 * ```
 */
export const withAuth =
  <CTX>(strategy: AuthStrategy<CTX>): HttpWrapper<CTX> =>
  (client: HttpClient<CTX>): HttpClient<CTX> => {
    const wrapped: WithAuthClient<CTX> = {
      ...client,
      bind: __AuthStrategy__ in client ? client.bind : wrapBind<CTX>(client.bind),
      [__AuthStrategy__]: strategy as AuthStrategy<unknown>,
    };

    return wrapped;
  };
