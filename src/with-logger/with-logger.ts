import type {
  BoundHttpClient,
  HeadersMap,
  HttpClient,
  HttpConfig,
  HttpWrapper,
  RequestOptions,
  RequestRoute,
} from '../types';
import type {LogLevel, LoggerLike, LoggerMeta, LoggerOptions} from './types';

import {RequestError} from '../client/request';

import {
  applyRedaction,
  buildRequestHeadersForLog,
  buildResponseHeadersForLog,
  computeResolved,
  DEFAULT_MAX_STRING_LENGTH,
  defaultMapLevel,
  normalizeInclude,
  normalizeRedaction,
  pickMethodAndUrl,
  resolveLogger,
  routeToString,
  shouldEmit,
} from './utils';

const __WithLogger__ = Symbol('WithLogger');

type WithLoggerClient<CTX> = HttpClient<CTX> & {
  [__WithLogger__]?: LoggerOptions<unknown>;
};

type PreparedLogContext<CTX> = {
  logger: LoggerLike;
  include: ReturnType<typeof normalizeInclude>;
  minLevel: LogLevel;
  maxStringLength: number;
  redaction: ReturnType<typeof normalizeRedaction>;
  mapLevel: NonNullable<LoggerOptions<CTX>['mapLevel']>;
  baseFields: Record<string, unknown>;
  ctxFields?: Record<string, unknown>;
  routeStr: string;
  method?: string;
  url?: string;
  requestHeaders?: HeadersMap;
  requestBody?: unknown;
};

const emitSafe = (logger: LoggerLike, level: LogLevel, event: unknown, message: string) => {
  const fn = logger[level];
  if (!fn) {
    return;
  }

  try {
    fn(event, message);
  } catch {
    // Logging must never break requests.
  }
};

const resolveEnabled = <CTX>(
  options: LoggerOptions<CTX>,
  meta: LoggerMeta<CTX>,
  logger: LoggerLike | undefined,
): boolean => {
  if (typeof options.enabled === 'function') {
    try {
      return Boolean(options.enabled(meta));
    } catch {
      return false;
    }
  }

  return options.enabled ?? Boolean(logger);
};

const resolveCtxFields = <CTX>(
  options: LoggerOptions<CTX>,
  ctx: CTX,
): Record<string, unknown> | undefined => {
  if (!options.getFields) {
    return undefined;
  }

  try {
    return options.getFields(ctx) ?? undefined;
  } catch {
    return undefined;
  }
};

const redactEvent = (
  payload: Record<string, unknown>,
  prepared: Pick<PreparedLogContext<unknown>, 'redaction' | 'maxStringLength'>,
) => {
  return applyRedaction(payload, {
    headerKeys: prepared.redaction.headerKeys,
    paths: prepared.redaction.paths,
    replace: prepared.redaction.replace,
    maxStringLength: prepared.maxStringLength,
  });
};

const logRequestStart = <CTX>(
  prepared: PreparedLogContext<CTX>,
  requestOptions: RequestOptions | undefined,
) => {
  if (!prepared.include.requestStart) {
    return;
  }

  const level: LogLevel = 'debug';
  if (!shouldEmit(prepared.minLevel, level)) {
    return;
  }

  const payload: Record<string, unknown> = {
    ...prepared.baseFields,
    ...(prepared.ctxFields ?? {}),
    event: 'http.request',
    route: prepared.routeStr,
    method: prepared.method,
    url: prepared.url,
    timeoutMs: requestOptions?.timeout,
    retries: requestOptions?.retries,
    request: {
      headers: prepared.requestHeaders,
      body: prepared.requestBody,
    },
  };

  const event = redactEvent(payload, prepared);
  emitSafe(prepared.logger, level, event, 'http.request');
};

const logResponseSuccess = <CTX>(
  prepared: PreparedLogContext<CTX>,
  response: {status: number; url: string; headers: HeadersMap; data: unknown},
  durationMs: number,
) => {
  if (!prepared.include.responseSuccess) {
    return;
  }

  const level = prepared.mapLevel({kind: 'response', status: response.status});
  if (!shouldEmit(prepared.minLevel, level)) {
    return;
  }

  const responseHeaders = prepared.include.headers
    ? buildResponseHeadersForLog(response.headers, prepared.redaction)
    : undefined;
  const responseBody = prepared.include.responseBody ? response.data : undefined;

  const payload: Record<string, unknown> = {
    ...prepared.baseFields,
    ...(prepared.ctxFields ?? {}),
    event: 'http.response',
    route: prepared.routeStr,
    method: prepared.method,
    url: response.url,
    status: response.status,
    durationMs,
    request: {
      headers: prepared.requestHeaders,
      body: prepared.requestBody,
    },
    response: {
      headers: responseHeaders,
      data: responseBody,
    },
  };

  const event = redactEvent(payload, prepared);
  emitSafe(prepared.logger, level, event, 'http.response');
};

const logError = <CTX>(
  prepared: PreparedLogContext<CTX>,
  error: unknown,
  input: {
    status?: number;
    url?: string;
    responseHeaders?: HeadersMap;
    responseData?: unknown;
    durationMs: number;
  },
) => {
  if (!prepared.include.responseError) {
    return;
  }

  const level = prepared.mapLevel({kind: 'error', status: input.status, error});
  if (!shouldEmit(prepared.minLevel, level)) {
    return;
  }

  const payload: Record<string, unknown> = {
    ...prepared.baseFields,
    ...(prepared.ctxFields ?? {}),
    event: 'http.error',
    route: prepared.routeStr,
    method: prepared.method,
    url: input.url ?? (prepared.include.resolvedUrl ? prepared.url : undefined),
    status: input.status,
    durationMs: input.durationMs,
    error: {
      name: (error as {name?: string})?.name,
      message: (error as {message?: string})?.message,
    },
    request: {
      headers: prepared.requestHeaders,
      body: prepared.requestBody,
    },
    response: {
      headers: prepared.include.headers
        ? buildResponseHeadersForLog(input.responseHeaders, prepared.redaction)
        : undefined,
      data: input.responseData,
    },
  };

  const event = redactEvent(payload, prepared);
  emitSafe(prepared.logger, level, event, 'http.error');
};

const wrapRequest = <CTX>(bound: BoundHttpClient, ctx: CTX, options: LoggerOptions<CTX>) =>
  async function (this: BoundHttpClient, route: RequestRoute, requestOptions?: RequestOptions) {
    const logger = resolveLogger(options, ctx);
    const include = normalizeInclude(options.include);

    const meta: LoggerMeta<CTX> = {ctx, route, options: requestOptions};
    const enabled = resolveEnabled(options, meta, logger);

    if (!enabled || !logger) {
      return bound.request.call(this, route, requestOptions);
    }

    const prepared: PreparedLogContext<CTX> = {
      logger,
      include,
      minLevel: options.level ?? 'info',
      maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
      redaction: normalizeRedaction(options.redact),
      mapLevel: options.mapLevel ?? defaultMapLevel,
      baseFields: options.baseFields ?? {},
      ctxFields: resolveCtxFields(options, ctx),
      routeStr: routeToString(route),
    };

    const resolved = computeResolved(
      bound.endpoint.bind(bound),
      route,
      requestOptions,
      include.resolvedUrl,
      include.headers,
    );
    const {method, url} = pickMethodAndUrl(resolved, route);
    prepared.method = method;
    prepared.url = url;

    prepared.requestHeaders = include.headers
      ? buildRequestHeadersForLog(resolved, requestOptions, prepared.redaction)
      : undefined;
    prepared.requestBody = include.requestBody
      ? (requestOptions?.data ?? requestOptions?.body)
      : undefined;

    logRequestStart(prepared, requestOptions);

    const startedAt = Date.now();
    try {
      const response = await bound.request.call(this, route, requestOptions);
      const durationMs = Date.now() - startedAt;

      logResponseSuccess(prepared, response, durationMs);

      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      let status: number | undefined;
      let errorUrl: string | undefined;
      let responseHeaders: HeadersMap | undefined;
      let responseData: unknown;
      if (error instanceof RequestError) {
        status = error.status;
        errorUrl = error.response?.url ?? error.request.url;
        responseHeaders = include.headers ? error.response?.headers : undefined;
        responseData = include.responseBody ? error.response?.data : undefined;
      }

      logError(prepared, error, {
        status,
        url: errorUrl,
        responseHeaders,
        responseData,
        durationMs,
      });

      throw error;
    }
  };

const wrapBind = <CTX>(bind: HttpClient<CTX>['bind']) =>
  function (this: WithLoggerClient<CTX>, ctx: CTX, config?: HttpConfig) {
    const bound = bind.call(this, ctx, config);
    const options = (this[__WithLogger__] ?? {}) as LoggerOptions<CTX>;

    return {
      ...bound,
      request: wrapRequest(bound, ctx, options),
    };
  };

/**
 * Add structured request/response/error logging to a client instance.
 *
 * Logging is opt-in: if no `logger` is provided, it is disabled by default.
 * The wrapper never throws for logger failures and never mutates request options.
 */
export const withLogger =
  <CTX>(options: LoggerOptions<CTX> = {}): HttpWrapper<CTX> =>
  (client: HttpClient<CTX>): HttpClient<CTX> => {
    const wrapped: WithLoggerClient<CTX> = {
      ...client,
      bind: __WithLogger__ in client ? client.bind : wrapBind(client.bind),
      [__WithLogger__]: options as LoggerOptions<unknown>,
    };

    return wrapped;
  };
