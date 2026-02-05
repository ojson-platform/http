import type {RequestOptions} from '../types';

/**
 * Auth strategy signature.
 */
export type AuthStrategy<CTX> = (
  ctx: CTX,
) => RequestOptions | Promise<RequestOptions | void> | void;
