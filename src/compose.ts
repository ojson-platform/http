import type {HttpClient, HttpOptions, HttpWrapper} from './types';

/**
 * HTTP client factory signature.
 */
export type HttpFactory<CTX = unknown> = (options: HttpOptions) => HttpClient<CTX>;

/**
 * Extracts ctx type from a wrapper.
 */
type WrapperCtx<W> = W extends HttpWrapper<infer CTX> ? CTX : never;

/**
 * Converts a union to intersection.
 */
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
  arg: infer I,
) => void
  ? I
  : never;

/**
 * Computes the final ctx type from a list of wrappers.
 */
type ComposeCtx<W extends readonly HttpWrapper<unknown>[]> = [W[number]] extends [never]
  ? unknown
  : UnionToIntersection<WrapperCtx<W[number]>>;

/**
 * Compose a base HTTP client factory with wrapper helpers.
 *
 * @param base Base factory (usually http).
 * @param wrappers Wrapper helpers applied in order.
 * @returns Factory that creates a wrapped HTTP client.
 *
 * ADR: docs/ADR/0003-compose-http-client.md
 */
export const compose = <W extends readonly HttpWrapper<unknown>[]>(
  base: HttpFactory,
  ...wrappers: W
): HttpFactory<ComposeCtx<W>> => {
  return (options: HttpOptions): HttpClient<ComposeCtx<W>> => {
    let client = base(options) as HttpClient<ComposeCtx<W>>;

    for (const wrapper of wrappers) {
      const apply = wrapper as HttpWrapper<ComposeCtx<W>>;
      client = apply(client);
    }

    return client;
  };
};
