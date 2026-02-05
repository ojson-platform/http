/**
 * How to encode deadline header value.
 */
export type DeadlineHeaderMode = 'absolute-ms' | 'relative-ms';

/**
 * Deadline propagation header configuration.
 */
export type DeadlineHeaderConfig = {
  /**
   * Header name.
   */
  name: string;
  /**
   * Value encoding mode.
   * Default: 'relative-ms'
   */
  mode?: DeadlineHeaderMode;
  /**
   * Do not overwrite an existing header.
   * Default: true
   */
  respectExisting?: boolean;
};

/**
 * Options for withTimeout.
 */
export type WithTimeoutOptions = {
  /**
   * Default timeout in milliseconds when not provided by request or bind.
   */
  defaultTimeout?: number;
  /**
   * Enable deadline propagation from ctx.
   * Default: true
   */
  propagateDeadline?: boolean;
  /**
   * Minimal effective timeout in milliseconds.
   * Default: 1
   */
  minTimeout?: number;
  /**
   * Resolve deadline from ctx (epoch ms).
   */
  getDeadline?: (ctx: unknown) => number | undefined;
  /**
   * Propagate deadline to downstream via a request header.
   */
  deadlineHeader?: string | DeadlineHeaderConfig;
};

/**
 * withTimeout argument shorthand.
 */
export type WithTimeoutArg = WithTimeoutOptions | number;
