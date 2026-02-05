import {describe, expect, it} from 'vitest';

import {
  DEFAULT_REDACT_HEADERS,
  applyRedaction,
  buildRequestHeadersForLog,
  buildResponseHeadersForLog,
  computeResolved,
  defaultMapLevel,
  normalizeInclude,
  normalizeRedaction,
  pickMethodAndUrl,
  redactHeaders,
  routeToString,
  sanitizeForLog,
} from './utils';

describe('withLogger utils', () => {
  it('normalizes include defaults', () => {
    expect(normalizeInclude(undefined)).toEqual({
      requestStart: false,
      responseSuccess: true,
      responseError: true,
      headers: false,
      requestBody: false,
      responseBody: false,
      resolvedUrl: true,
    });
  });

  it('normalizes redaction defaults', () => {
    const redaction = normalizeRedaction(undefined);
    DEFAULT_REDACT_HEADERS.forEach(header => {
      expect(redaction.headerKeys?.has(header)).toBe(true);
    });
  });

  it('redacts headers by default list', () => {
    const redaction = normalizeRedaction(undefined);
    const headers = redactHeaders(
      {authorization: 'Bearer x', cookie: 'a=b', 'x-other': 'ok'},
      redaction.headerKeys,
      redaction.replace,
    );

    expect(headers).toEqual({
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      'x-other': 'ok',
    });
  });

  it('can disable redaction entirely', () => {
    const redaction = normalizeRedaction(false);
    expect(redaction.headerKeys).toBeNull();
  });

  it('applies path redaction on sanitized payload', () => {
    const payload = {request: {body: {password: 'secret'}}};
    const redacted = applyRedaction(payload, {
      headerKeys: new Set(),
      paths: ['request.body.password'],
      replace: '[REDACTED]',
      maxStringLength: 1024,
    });

    expect(redacted).toEqual({
      request: {body: {password: '[REDACTED]'}},
    });
  });

  it('sanitizes circular references and truncates strings', () => {
    const value: any = {text: 'x'.repeat(64)};
    value.self = value;

    const sanitized = sanitizeForLog(value, 16) as Record<string, unknown>;
    expect(sanitized.self).toBe('[Circular]');
    expect(sanitized.text as string).toContain('…(truncated');
  });

  it('maps default levels correctly', () => {
    expect(defaultMapLevel({kind: 'response', status: 200})).toBe('info');
    expect(defaultMapLevel({kind: 'error', status: 404})).toBe('warn');
    expect(defaultMapLevel({kind: 'error', status: 503})).toBe('error');
    expect(defaultMapLevel({kind: 'error', error: {name: 'AbortError'}})).toBe('warn');
  });

  it('formats route string and picks method/url', () => {
    expect(routeToString('GET /lists')).toBe('GET /lists');
    expect(routeToString({method: 'post', url: '/lists'})).toBe('POST /lists');

    const fromString = pickMethodAndUrl(undefined, 'POST /items');
    expect(fromString).toEqual({method: 'POST', url: '/items'});

    const fromObject = pickMethodAndUrl(undefined, {method: 'put', url: '/items/1'});
    expect(fromObject).toEqual({method: 'PUT', url: '/items/1'});
  });

  it('pickMethodAndUrl returns method only when route string has no space', () => {
    expect(pickMethodAndUrl(undefined, 'GET')).toEqual({method: 'GET'});
  });

  it('applyRedaction skips path when intermediate key is missing', () => {
    const payload = {request: {}};
    const result = applyRedaction(payload, {
      headerKeys: new Set(),
      paths: ['request.body.password'],
      replace: '[REDACTED]',
      maxStringLength: 1024,
    });
    expect(result).toEqual({request: {}});
  });

  it('applyRedaction skips path when intermediate value is not an object', () => {
    const payload = {a: {b: 'string'}};
    const result = applyRedaction(payload, {
      headerKeys: new Set(),
      paths: ['a.b.c'],
      replace: '[REDACTED]',
      maxStringLength: 1024,
    });
    expect(result).toEqual({a: {b: 'string'}});
  });

  it('computeResolved returns undefined when both include flags are false', () => {
    const endpointFn = () => ({method: 'GET', url: 'https://a/', headers: {}});
    expect(computeResolved(endpointFn, 'GET /x', undefined, false, false)).toBeUndefined();
  });

  it('buildRequestHeadersForLog returns undefined when no headers', () => {
    expect(
      buildRequestHeadersForLog(undefined, undefined, {
        headerKeys: new Set(),
        replace: '[REDACTED]',
      }),
    ).toBeUndefined();
  });

  it('buildResponseHeadersForLog returns undefined when headers empty or undefined', () => {
    const redaction = {headerKeys: new Set(), replace: '[REDACTED]'};
    expect(buildResponseHeadersForLog(undefined, redaction)).toBeUndefined();
    expect(buildResponseHeadersForLog({}, redaction)).toBeUndefined();
  });
});
