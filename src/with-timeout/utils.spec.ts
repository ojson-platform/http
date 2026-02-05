import {describe, expect, it} from 'vitest';

import {asOptions, clampMin, getDeadlineMs, parseDeadlineHeader} from './utils';

describe('asOptions', () => {
  it('returns empty object when arg is undefined', () => {
    expect(asOptions(undefined)).toEqual({});
  });

  it('returns defaultTimeout when arg is number', () => {
    expect(asOptions(500)).toEqual({defaultTimeout: 500});
  });

  it('returns arg when arg is object', () => {
    const opts = {defaultTimeout: 1000, minTimeout: 2};
    expect(asOptions(opts)).toBe(opts);
  });
});

describe('parseDeadlineHeader', () => {
  it('returns object config as-is', () => {
    const config = {name: 'x-deadline', mode: 'absolute-ms' as const};
    expect(parseDeadlineHeader(config)).toBe(config);
  });

  it('parses shorthand "name,mode"', () => {
    expect(parseDeadlineHeader('x-timeout,relative-ms')).toEqual({
      name: 'x-timeout',
      mode: 'relative-ms',
    });
    expect(parseDeadlineHeader('x-timeout,absolute-ms')).toEqual({
      name: 'x-timeout',
      mode: 'absolute-ms',
    });
  });

  it('defaults mode to relative-ms when omitted', () => {
    expect(parseDeadlineHeader('x-timeout')).toEqual({
      name: 'x-timeout',
      mode: 'relative-ms',
    });
  });

  it('throws when header name is empty', () => {
    expect(() => parseDeadlineHeader(',')).toThrow(/header name/);
  });

  it('throws when mode is invalid', () => {
    expect(() => parseDeadlineHeader('x-timeout,invalid')).toThrow(/Invalid deadlineHeader mode/);
  });
});

describe('getDeadlineMs', () => {
  it('returns value from getDeadline option when provided', () => {
    expect(getDeadlineMs({}, {getDeadline: () => 2000})).toBe(2000);
  });

  it('returns ctx.deadline when getDeadline not used', () => {
    expect(getDeadlineMs({deadline: 3000}, {})).toBe(3000);
  });

  it('returns undefined when no source', () => {
    expect(getDeadlineMs({}, {})).toBeUndefined();
    expect(getDeadlineMs({deadline: 'not a number'}, {})).toBeUndefined();
  });
});

describe('clampMin', () => {
  it('returns value when >= min', () => {
    expect(clampMin(10, 1)).toBe(10);
  });

  it('returns min when value < min', () => {
    expect(clampMin(0.5, 1)).toBe(1);
  });
});
