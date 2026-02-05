/**
 * Result type for getId resolvers.
 */
export type GetIdResult = string | null | undefined;

/**
 * Options for withTracing.
 */
export type WithTracingOptions = {
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
