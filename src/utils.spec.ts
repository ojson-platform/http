import {describe, expect, it} from 'vitest';

import {mergeConfig, mergeRequestOptions, normalizeHeaders} from './utils';

describe('normalizeHeaders', () => {
  it('preserves duplicate header entries as arrays', () => {
    const headers = [
      ['cache-control', 'max-age=604800'],
      ['cache-control', 'max-stale=3600'],
    ] as [string, string][];

    const normalized = normalizeHeaders(headers);

    expect(normalized['cache-control']).toEqual(['max-age=604800', 'max-stale=3600']);
  });

  it('keeps array values from map input', () => {
    const normalized = normalizeHeaders({
      'set-cookie': ['a=1; Path=/', 'b=2; Path=/'],
    });

    expect(normalized['set-cookie']).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });
});

describe('mergeRequestOptions', () => {
  it('accumulates set-cookie values', () => {
    const merged = mergeRequestOptions(
      {headers: {'set-cookie': 'a=1; Path=/'}},
      {headers: {'set-cookie': 'b=2; Path=/'}},
    );

    expect(merged.headers?.['set-cookie']).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('overrides non-array headers by default', () => {
    const merged = mergeRequestOptions(
      {headers: {'cache-control': 'max-age=10'}},
      {headers: {'cache-control': 'no-cache'}},
    );

    expect(merged.headers?.['cache-control']).toBe('no-cache');
  });

  it('preserves base headers when next is empty', () => {
    const merged = mergeRequestOptions(
      {headers: {'x-custom': 'from-base', 'accept': 'application/json'}},
      {},
    );

    expect(merged.headers?.['x-custom']).toBe('from-base');
    expect(merged.headers?.['accept']).toBe('application/json');
  });
});

describe('mergeConfig', () => {
  it('returns undefined when both base and next are undefined', () => {
    expect(mergeConfig(undefined, undefined)).toBeUndefined();
  });

  it('returns next timeout when both have timeout', () => {
    const result = mergeConfig({timeout: 100, headers: {}}, {timeout: 200});
    expect(result?.timeout).toBe(200);
  });

  it('returns base timeout when next has no timeout', () => {
    const result = mergeConfig({timeout: 100}, {});
    expect(result?.timeout).toBe(100);
  });

  it('merges headers from base and next', () => {
    const result = mergeConfig(
      {headers: {'x-base': 'a'}},
      {headers: {'x-next': 'b'}},
    );
    expect(result?.headers).toEqual({['x-base']: 'a', ['x-next']: 'b'});
  });

  it('returns next-only config when base is undefined', () => {
    const result = mergeConfig(undefined, {timeout: 50, headers: {'a': '1'}});
    expect(result?.timeout).toBe(50);
    expect(result?.headers).toEqual({a: '1'});
  });
});
