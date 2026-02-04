import type {HttpWrapper} from '../types';

export type GetIdResult = string | null | undefined;

export type TracingOptions = {
  /**
   * Correlation header name.
   * Default: `x-request-id`
   */
  headerName?: string;

  /**
   * Resolve correlation id from ctx.
   *
   * The function may be async.
   * If it returns `null | undefined | ''`, the header is not set.
   */
  getId?: (ctx: unknown) => GetIdResult | Promise<GetIdResult>;
};

export type WithTracingState = {
  opts: TracingOptions;
};

export type WithTracingWrapper = (opts?: TracingOptions) => HttpWrapper;
