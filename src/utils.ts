import type {
  EndpointOptions,
  HeaderValue,
  HeadersInput,
  HeadersMap,
  HttpConfig,
  RequestOptions,
} from './types';

/**
 * Check if value is a plain object.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.getPrototypeOf(value) === Object.prototype;
};

/**
 * Check if value is an object-like record (including class instances).
 */
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeHeaderKey = (key: string): string => key.toLowerCase();

/**
 * Normalize header keys to lowercase.
 */
const appendHeaderValue = (acc: HeadersMap, key: string, value: HeaderValue): void => {
  const nextValues = Array.isArray(value) ? value : [value];
  const existing = acc[key];
  if (existing === undefined) {
    acc[key] = value;
    return;
  }

  const existingValues = Array.isArray(existing) ? existing : [existing];
  acc[key] = [...existingValues, ...nextValues];
};

const normalizeHeaders = (headers?: HeadersInput): HeadersMap => {
  if (!headers) {
    return {};
  }

  if (Array.isArray(headers)) {
    return headers.reduce<HeadersMap>((acc, [key, value]) => {
      appendHeaderValue(acc, normalizeHeaderKey(key), value);
      return acc;
    }, {});
  }

  return Object.keys(headers).reduce<HeadersMap>((acc, key) => {
    appendHeaderValue(acc, normalizeHeaderKey(key), headers[key]);
    return acc;
  }, {});
};

/**
 * Check if headers contain a key (case-insensitive).
 */
const hasHeader = (headers: HeadersInput | undefined, name: string): boolean => {
  const normalized = normalizeHeaders(headers);
  return Object.hasOwn(normalized, name.toLowerCase());
};

/**
 * Remove undefined values recursively from objects and arrays.
 */
const removeUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (entry === undefined) {
      return acc;
    }
    acc[key] = removeUndefined(entry);
    return acc;
  }, {});
};

/**
 * Deep merge for plain objects with undefined removal.
 */
const mergeDeep = <T>(base: T, next: T): T => {
  if (isPlainObject(base) && isPlainObject(next)) {
    const result: Record<string, unknown> = {...base};
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      const existing = result[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        result[key] = mergeDeep(existing, value);
        return;
      }

      result[key] = value;
    });
    return result as T;
  }

  return next;
};

/**
 * Merge headers preserving last-wins behavior.
 */
const mergeHeaders = (base?: HeadersMap, next?: HeadersMap): HeadersMap => {
  const merged: HeadersMap = base != null ? {...base} : {};
  if (!next) {
    return merged;
  }

  Object.entries(next).forEach(([key, value]) => {
    const existing = merged[key];
    if (key === 'set-cookie' || Array.isArray(existing) || Array.isArray(value)) {
      appendHeaderValue(merged, key, value);
      return;
    }

    merged[key] = value;
  });

  return merged;
};

/**
 * Normalize request options by removing undefined values.
 */
const normalizeRequestOptions = (options?: RequestOptions | EndpointOptions): RequestOptions => {
  if (!options) {
    return {};
  }

  return removeUndefined(options) as RequestOptions;
};

/**
 * Merge two request option objects.
 */
const mergeRequestOptions = (base: RequestOptions, next?: RequestOptions): RequestOptions => {
  const normalizedNext = normalizeRequestOptions(next);
  const merged = mergeDeep(base, normalizedNext);
  merged.headers = mergeHeaders(
    normalizeHeaders(base.headers),
    normalizeHeaders(normalizedNext.headers),
  );
  return merged;
};

/**
 * Apply declarative config to request options.
 */
const applyConfigToOptions = (options: RequestOptions, config?: HttpConfig): RequestOptions => {
  if (!config) {
    return options;
  }

  return {
    ...options,
    headers: mergeHeaders(normalizeHeaders(config.headers), normalizeHeaders(options.headers)),
    timeout: options.timeout ?? config.timeout,
  };
};

/**
 * Merge two HttpConfig objects.
 */
const mergeConfig = (base?: HttpConfig, next?: HttpConfig): HttpConfig | undefined => {
  if (!base && !next) {
    return undefined;
  }

  return {
    headers: mergeHeaders(normalizeHeaders(base?.headers), normalizeHeaders(next?.headers)),
    timeout: next?.timeout ?? base?.timeout,
  };
};

export {
  applyConfigToOptions,
  hasHeader,
  isObject,
  isPlainObject,
  mergeDeep,
  mergeConfig,
  mergeRequestOptions,
  normalizeHeaders,
  normalizeRequestOptions,
  removeUndefined,
};
