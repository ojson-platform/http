import type {EndpointResult, HeadersMap, RequestOptions, RequestRoute} from '../types';
import type {LogLevel, LoggerLike, RedactConfig, WithLoggerOptions} from './types';

import {normalizeHeaders} from '../utils';

export const DEFAULT_MAX_STRING_LENGTH = 8_192;

export const DEFAULT_REDACT_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
] as const;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as {name?: string}).name === 'AbortError';
};

export const routeToString = (route: RequestRoute): string => {
  if (typeof route === 'string') {
    return route;
  }

  return `${String(route.method).toUpperCase()} ${route.url}`;
};

export const shouldEmit = (minLevel: LogLevel, level: LogLevel): boolean => {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
};

export const defaultMapLevel = (input: {
  kind: 'response' | 'error';
  status?: number;
  error?: unknown;
}) => {
  if (input.kind === 'response') {
    return 'info' as const;
  }

  if (isAbortError(input.error)) {
    return 'warn' as const;
  }

  const status = input.status;
  if (status !== undefined) {
    if (status >= 500) {
      return 'error' as const;
    }

    if (status >= 400) {
      return 'warn' as const;
    }
  }

  return 'error' as const;
};

export const resolveLogger = <CTX>(
  opts: WithLoggerOptions<CTX>,
  ctx: CTX,
): LoggerLike | undefined => {
  if (!opts.logger) {
    return undefined;
  }

  if (typeof opts.logger === 'function') {
    return opts.logger(ctx);
  }

  return opts.logger;
};

export const normalizeInclude = (
  include: WithLoggerOptions['include'] | undefined,
): Required<NonNullable<WithLoggerOptions['include']>> => {
  return {
    requestStart: include?.requestStart ?? false,
    responseSuccess: include?.responseSuccess ?? true,
    responseError: include?.responseError ?? true,
    headers: include?.headers ?? false,
    requestBody: include?.requestBody ?? false,
    responseBody: include?.responseBody ?? false,
    resolvedUrl: include?.resolvedUrl ?? true,
  };
};

type Redaction = {
  headerKeys: Set<string> | null;
  paths: string[];
  replace: string;
};

export const normalizeRedaction = (redact: RedactConfig | undefined): Redaction => {
  if (redact === false) {
    return {headerKeys: null, paths: [], replace: '[REDACTED]'};
  }

  const replace = redact?.replace ?? '[REDACTED]';

  let headerKeys: Set<string> | null = null;
  const headerRule = redact?.headers;
  if (headerRule !== undefined) {
    headerKeys = new Set<string>();
    const list = headerRule === true ? [...DEFAULT_REDACT_HEADERS] : headerRule;
    list.forEach(name => headerKeys?.add(name.toLowerCase()));
  } else {
    headerKeys = new Set<string>();
    DEFAULT_REDACT_HEADERS.forEach(name => headerKeys?.add(name));
  }

  const paths = redact?.paths ?? [];
  return {headerKeys, paths, replace};
};

export const redactHeaders = (
  headers: HeadersMap,
  headerKeys: Set<string> | null,
  replace: string,
): HeadersMap => {
  if (!headerKeys) {
    return headers;
  }

  const next: HeadersMap = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (headerKeys.has(key.toLowerCase())) {
      next[key] = Array.isArray(value) ? value.map(() => replace) : replace;
      return;
    }

    next[key] = value;
  });
  return next;
};

const truncateString = (value: string, maxLen: number): string => {
  if (value.length <= maxLen) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLen - 16))}…(truncated ${value.length - maxLen} chars)`;
};

export const sanitizeForLog = (
  value: unknown,
  maxStringLength: number,
  seen: WeakMap<object, unknown> = new WeakMap(),
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value, maxStringLength);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(String(value.message ?? ''), maxStringLength),
      stack: value.stack ? truncateString(String(value.stack), maxStringLength) : undefined,
    };
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  const existing = seen.get(value);
  if (existing) {
    return '[Circular]';
  }
  seen.set(value, true);

  if (Array.isArray(value)) {
    return value.map(entry => sanitizeForLog(entry, maxStringLength, seen));
  }

  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
    out[k] = sanitizeForLog(v, maxStringLength, seen);
  });

  return out;
};

const setByPath = (root: unknown, path: string, replace: string) => {
  if (!root || typeof root !== 'object') {
    return;
  }

  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let cursor: unknown = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!cursor || typeof cursor !== 'object') {
      return;
    }

    const next = (cursor as Record<string, unknown>)[key];
    if (!next || typeof next !== 'object') {
      return;
    }

    cursor = next;
  }

  const last = parts[parts.length - 1];
  if (!cursor || typeof cursor !== 'object') {
    return;
  }

  const record = cursor as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, last)) {
    record[last] = replace;
  }
};

export const applyRedaction = (
  payload: Record<string, unknown>,
  input: {
    headerKeys: Set<string> | null;
    paths: string[];
    replace: string;
    maxStringLength: number;
  },
): Record<string, unknown> => {
  // Sanitize first (so we never throw during logging), then redact by paths.
  const sanitized = sanitizeForLog(payload, input.maxStringLength) as Record<string, unknown>;
  input.paths.forEach(path => setByPath(sanitized, path, input.replace));
  return sanitized;
};

export const pickMethodAndUrl = (
  resolved: EndpointResult | undefined,
  route: RequestRoute,
): {method?: string; url?: string} => {
  if (resolved) {
    return {method: resolved.method, url: resolved.url};
  }

  if (typeof route === 'string') {
    const idx = route.indexOf(' ');
    if (idx > 0) {
      return {method: route.slice(0, idx).toUpperCase(), url: route.slice(idx + 1)};
    }
    return {method: route.toUpperCase()};
  }

  return {method: String(route.method).toUpperCase(), url: route.url};
};

export const computeResolved = (
  endpointFn: (route: RequestRoute, options?: RequestOptions) => EndpointResult,
  route: RequestRoute,
  options: RequestOptions | undefined,
  includeResolvedUrl: boolean,
  includeHeaders: boolean,
): EndpointResult | undefined => {
  if (!includeResolvedUrl && !includeHeaders) {
    return undefined;
  }

  return endpointFn(route, options);
};

export const buildRequestHeadersForLog = (
  resolved: EndpointResult | undefined,
  options: RequestOptions | undefined,
  redaction: {headerKeys: Set<string> | null; replace: string},
): HeadersMap | undefined => {
  const normalized = resolved ? resolved.headers : normalizeHeaders(options?.headers);
  if (!normalized || Object.keys(normalized).length === 0) {
    return undefined;
  }

  return redactHeaders(normalized, redaction.headerKeys, redaction.replace);
};

export const buildResponseHeadersForLog = (
  headers: HeadersMap | undefined,
  redaction: {headerKeys: Set<string> | null; replace: string},
): HeadersMap | undefined => {
  if (!headers || Object.keys(headers).length === 0) {
    return undefined;
  }

  return redactHeaders(headers, redaction.headerKeys, redaction.replace);
};
