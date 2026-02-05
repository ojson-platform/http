import type {RequestOptions, RequestRoute} from '../types';

/**
 * Supported log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal logger interface compatible with popular loggers (pino, bunyan-like).
 *
 * Implementations MAY omit some methods; missing levels are treated as no-op.
 */
export type LoggerLike = {
  debug?: (event: unknown, message?: string) => void;
  info?: (event: unknown, message?: string) => void;
  warn?: (event: unknown, message?: string) => void;
  error?: (event: unknown, message?: string) => void;
};

/**
 * Logger meta used for per-request enablement.
 */
export type LoggerMeta<CTX = unknown> = {
  ctx: CTX;
  route: RequestRoute;
  options?: RequestOptions;
};

/**
 * Redaction configuration for log payloads.
 */
export type RedactConfig =
  | false
  | {
      /**
       * Header names to redact (case-insensitive).
       * Default includes: authorization, cookie, set-cookie, x-api-key.
       */
      headers?: true | string[];

      /**
       * Object paths to redact (dot paths).
       * Example: ["request.body.password", "response.data.token"].
       */
      paths?: string[];

      /**
       * Replacement string.
       * Default: "[REDACTED]".
       */
      replace?: string;
    };

/**
 * withLogger configuration.
 */
export type LoggerOptions<CTX = unknown> = {
  /**
   * Logger implementation.
   *
   * - If omitted, logging is disabled by default (opt-in).
   * - If provided as a function, it may resolve a logger from ctx.
   */
  logger?: LoggerLike | ((ctx: CTX) => LoggerLike | undefined);

  /**
   * Minimal level to emit.
   * Default: "info".
   */
  level?: LogLevel;

  /**
   * Enable logging toggle.
   * Default: true if `logger` is provided, otherwise false.
   */
  enabled?: boolean | ((meta: LoggerMeta<CTX>) => boolean);

  /**
   * What to log.
   * Defaults are intentionally conservative.
   */
  include?: {
    /**
     * Log an entry before executing the request.
     * Default: false.
     */
    requestStart?: boolean;

    /**
     * Log successful responses (2xx/3xx).
     * Default: true.
     */
    responseSuccess?: boolean;

    /**
     * Log failed responses / errors.
     * Default: true.
     */
    responseError?: boolean;

    /**
     * Include headers in logs (after redaction).
     * Default: false.
     */
    headers?: boolean;

    /**
     * Include request body in logs (after redaction).
     * Default: false.
     */
    requestBody?: boolean;

    /**
     * Include response body in logs (after redaction).
     * Default: false.
     */
    responseBody?: boolean;

    /**
     * Include resolved URL (computed via `bound.endpoint()`).
     * Can be disabled to avoid extra work.
     * Default: true.
     */
    resolvedUrl?: boolean;
  };

  /**
   * Redaction rules.
   * Default: enabled with safe header redaction.
   */
  redact?: RedactConfig;

  /**
   * How to map status/errors to levels.
   * If not provided, defaults are:
   * - success -> info
   * - 4xx -> warn
   * - 5xx/network -> error
   * - AbortError -> warn
   */
  mapLevel?: (event: {kind: 'response' | 'error'; status?: number; error?: unknown}) => LogLevel;

  /**
   * Extra fields to attach to every log entry.
   * Useful for service name, environment, etc.
   */
  baseFields?: Record<string, unknown>;

  /**
   * Extract extra fields from ctx (e.g. request id).
   */
  getFields?: (ctx: CTX) => Record<string, unknown> | undefined;

  /**
   * Limit large strings (bodies, error stacks).
   * Default: 8_192.
   */
  maxStringLength?: number;
};
