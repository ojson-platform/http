import type {HttpClient, HttpOptions} from '../types';

import {mergeConfig} from '../utils';

import {bind} from './bind';

/**
 * Create a base HTTP client with the provided options.
 * @param options Base client options such as endpoint and fetch implementation.
 * @returns HTTP client instance.
 *
 * ADR: docs/ADR/0001-require-bind.md
 */
export const http = (options: HttpOptions): HttpClient<unknown> => {
  const input = {
    baseUrl: options.endpoint,
    fetch: options.fetch,
  };
  const baseConfig = options.config;

  return {
    bind: (ctx, config) => bind({...input, ctx}, mergeConfig(baseConfig, config)),
  };
};
