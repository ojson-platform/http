import type {RequestOptions} from '../types';

/**
 * Auth strategy signature.
 *
 * The returned options are merged on top of request options (auth wins on conflicts).
 */
export type AuthStrategy<CTX> = (
  ctx: CTX,
) => RequestOptions | Promise<RequestOptions | void> | void;
