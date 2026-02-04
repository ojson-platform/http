import type {
  BoundHttpClient,
  EndpointOptions,
  FetchImpl,
  HttpConfig,
  RequestOptions,
  RequestRoute,
} from '../types';

import {endpoint} from './endpoint';
import {request} from './request';
import {applyConfigToOptions, normalizeRequestOptions} from '../utils';

type BindInput = {
  baseUrl: string;
  fetch?: FetchImpl;
  ctx: unknown;
};

const __BindInput__ = Symbol('bind.input');
const __BindConfig__ = Symbol('bind.config');

type BoundState = BoundHttpClient & {
  [__BindInput__]: BindInput;
  [__BindConfig__]?: HttpConfig;
};

const buildOptions = (
  input: BindInput,
  config: HttpConfig | undefined,
  options?: RequestOptions | EndpointOptions,
): RequestOptions => {
  const normalized = normalizeRequestOptions(options);
  const withConfig = applyConfigToOptions(normalized, config);
  return {
    ...withConfig,
    baseUrl: withConfig.baseUrl ?? input.baseUrl,
    ctx: withConfig.ctx ?? input.ctx,
  };
};

const endpointBound: BoundHttpClient['endpoint'] = function (
  this: BoundHttpClient,
  route: RequestRoute,
  options?: EndpointOptions,
) {
  const state = this as BoundState;
  return endpoint(route, buildOptions(state[__BindInput__], state[__BindConfig__], options));
};

const requestBound: BoundHttpClient['request'] = function (
  this: BoundHttpClient,
  route: RequestRoute,
  options?: RequestOptions,
) {
  const state = this as BoundState;
  return request(route, buildOptions(state[__BindInput__], state[__BindConfig__], options), {
    fetch: state[__BindInput__].fetch,
  });
};

/**
 * Bind base configuration to a client instance.
 * @param input Base options and fetch implementation.
 * @param config Optional config overrides for the bound instance.
 * @returns Bound client with merged defaults.
 *
 * ADR: docs/ADR/0001-require-bind.md
 */
export const bind = (input: BindInput, config?: HttpConfig): BoundHttpClient => {
  if (input.ctx === undefined) {
    throw new Error('http.bind(ctx) requires a non-undefined ctx value.');
  }

  const bound: BoundState = {
    [__BindInput__]: input,
    [__BindConfig__]: config,
    endpoint: endpointBound,
    request: requestBound,
  };

  return bound;
};
