import type {HttpClient, HttpOptions, HttpWrapper} from './types';

/**
 * HTTP client factory signature.
 */
export type HttpFactory<CTX = unknown> = (options: HttpOptions) => HttpClient<CTX>;

/**
 * Compose a base HTTP client factory with wrapper helpers.
 *
 * @param base Base factory (usually http).
 * @param wrappers Wrapper helpers applied in order.
 * @returns Factory that creates a wrapped HTTP client.
 *
 * ADR: docs/ADR/0003-compose-http-client.md
 */
export const compose = <CTX = unknown>(
  base: HttpFactory,
  ...wrappers: Array<HttpWrapper<CTX>>
): HttpFactory<CTX> => {
  return (options: HttpOptions): HttpClient<CTX> => {
    let client = base(options) as HttpClient<CTX>;

    for (const wrapper of wrappers) {
      client = wrapper(client);
    }

    return client;
  };
};
