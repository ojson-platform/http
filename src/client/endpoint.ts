import type {EndpointOptions, EndpointResult, HeadersMap, RequestRoute} from '../types';

import {normalizeHeaders} from '../utils';

const METHOD_PATTERN = /^[A-Z]+$/;
const JSON_CONTENT_TYPE = 'application/json';

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const joinUrl = (baseUrl: string, path: string): string => {
  if (isAbsoluteUrl(path)) {
    return path;
  }

  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
};

const parseRoute = (route: RequestRoute): {method: string; url: string} => {
  if (typeof route !== 'string') {
    return {
      method: route.method.toUpperCase(),
      url: route.url,
    };
  }

  const parts = route.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Invalid route "${route}". Expected "METHOD /path".`);
  }

  const [method, ...rest] = parts;
  const url = rest.join(' ');
  const normalizedMethod = method.toUpperCase();
  if (!METHOD_PATTERN.test(normalizedMethod)) {
    throw new Error(`Invalid HTTP method "${method}".`);
  }

  return {method: normalizedMethod, url};
};

const applyParams = (url: string, params?: Record<string, string | number>): string => {
  if (!params) {
    return url;
  }

  const replaced = url.replace(/\{([^}]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      throw new Error(`Missing param "${key}" for url "${url}".`);
    }

    return encodeURIComponent(String(params[key]));
  });

  if (/\{[^}]+\}/.test(replaced)) {
    throw new Error(`Missing params for url "${url}".`);
  }

  return replaced;
};

const appendQuery = (
  url: string,
  query?: Record<string, string | number | boolean | (string | number | boolean)[]>,
): string => {
  if (!query) {
    return url;
  }

  const [path, existingQuery = ''] = url.split('?', 2);
  const params = new URLSearchParams(existingQuery);

  Object.entries(query).forEach(([key, value]) => {
    params.delete(key);
    if (Array.isArray(value)) {
      value.forEach(entry => params.append(key, String(entry)));
      return;
    }

    params.append(key, String(value));
  });

  const queryString = params.toString();
  if (!queryString) {
    return path;
  }

  return `${path}?${queryString}`;
};

const buildBody = (
  options: EndpointOptions,
  headers: HeadersMap,
): {body?: unknown; headers: HeadersMap} => {
  if (options.data !== undefined) {
    return {
      body: options.data,
      headers,
    };
  }

  if (options.body === undefined) {
    return {headers};
  }

  const normalized = {...headers};
  if (!normalized['content-type']) {
    normalized['content-type'] = JSON_CONTENT_TYPE;
  }

  return {
    body: JSON.stringify(options.body),
    headers: normalized,
  };
};

/**
 * Build a request descriptor from route and options.
 * @param route Request route in "METHOD /path" or object form.
 * @param options Endpoint options such as params, query, headers, body.
 * @returns Normalized endpoint result for request execution.
 */
export const endpoint = (route: RequestRoute, options: EndpointOptions = {}): EndpointResult => {
  const {method, url: rawUrl} = parseRoute(route);
  const resolvedBase = options.baseUrl;
  const withBase = resolvedBase ? joinUrl(resolvedBase, rawUrl) : rawUrl;
  const withParams = applyParams(withBase, options.params);
  const withQuery = appendQuery(withParams, options.query);
  const headers = normalizeHeaders(options.headers);
  const bodyResult = buildBody(options, headers);

  return {
    method,
    url: withQuery,
    headers: bodyResult.headers,
    body: bodyResult.body,
  };
};
