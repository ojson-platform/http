import {describe, expect, it} from 'vitest';

import {mergeRequestOptions, normalizeHeaders} from './utils';

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
});
