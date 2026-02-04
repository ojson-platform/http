import type {HttpWrapper, RequestOptions} from '../types';

/**
 * Auth strategy signature.
 */
export type AuthStrategy<CTX> = (
  ctx: CTX,
) => RequestOptions | Promise<RequestOptions | void> | void;

/**
 * Wrapper signature for HTTP client extensions.
 */
export type {HttpWrapper};
