import {describe, expect, it, vi} from 'vitest';

import {
  applyJitterSeconds,
  buildBackoffScheduleSeconds,
  BUDGET_PRESETS,
  isAbortError,
  isIdempotentMethod,
  parseBudget,
  parseRetriesShorthand,
  parseRetryAfterSeconds,
  parseRouteMethod,
  resolveRetriesScheduleSeconds,
  sleepMs,
} from './utils';

describe('parseRetriesShorthand', () => {
  it('returns undefined when parts length is not 3', () => {
    expect(parseRetriesShorthand('exp,1')).toBeUndefined();
    expect(parseRetriesShorthand('exp,1,2,3')).toBeUndefined();
    expect(parseRetriesShorthand('')).toBeUndefined();
  });

  it('returns undefined for invalid strategy', () => {
    expect(parseRetriesShorthand('fixed,1,2')).toBeUndefined();
  });

  it('returns undefined for invalid baseDelay or retries', () => {
    expect(parseRetriesShorthand('exp,NaN,2')).toBeUndefined();
    expect(parseRetriesShorthand('exp,1,-1')).toBeUndefined();
    expect(parseRetriesShorthand('exp,-1,1')).toBeUndefined();
  });

  it('returns parsed config for valid shorthand', () => {
    expect(parseRetriesShorthand('exp,1,3')).toEqual({
      strategy: 'exp',
      baseDelay: 1,
      retries: 3,
    });
    expect(parseRetriesShorthand('linear,0.5,2')).toEqual({
      strategy: 'linear',
      baseDelay: 0.5,
      retries: 2,
    });
  });
});

describe('parseBudget', () => {
  it('returns undefined for undefined or "off"', () => {
    expect(parseBudget(undefined)).toBeUndefined();
    expect(parseBudget('off')).toBeUndefined();
  });

  it('returns preset for conservative, balanced, aggressive', () => {
    expect(parseBudget('conservative')).toEqual(BUDGET_PRESETS.conservative);
    expect(parseBudget('balanced')).toEqual(BUDGET_PRESETS.balanced);
    expect(parseBudget('aggressive')).toEqual(BUDGET_PRESETS.aggressive);
  });

  it('parses budget shorthand "budget,N,M,K"', () => {
    expect(parseBudget('budget,5,0.1,1')).toEqual({
      maxTokens: 5,
      refillOnSuccess: 0.1,
      costPerRetry: 1,
    });
  });

  it('throws TypeError for invalid budget shorthand', () => {
    expect(() => parseBudget('budget,1,2')).toThrow(TypeError);
    expect(() => parseBudget('budget,a,0.1,1')).toThrow(TypeError);
  });

  it('throws TypeError for unknown preset string', () => {
    expect(() => parseBudget('unknown')).toThrow(TypeError);
  });

  it('returns object config as-is', () => {
    const config = {maxTokens: 3, refillOnSuccess: 0.2, costPerRetry: 2};
    expect(parseBudget(config)).toBe(config);
  });
});

describe('parseRetryAfterSeconds', () => {
  it('returns undefined when no retry-after header', () => {
    expect(parseRetryAfterSeconds(undefined)).toBeUndefined();
    expect(parseRetryAfterSeconds({})).toBeUndefined();
  });

  it('parses Retry-After in seconds', () => {
    expect(parseRetryAfterSeconds({'retry-after': '5'})).toBe(5);
    expect(parseRetryAfterSeconds({'retry-after': '0'})).toBe(0);
  });

  it('parses Retry-After as HTTP-date', () => {
    const future = new Date(Date.now() + 3000);
    const value = future.toUTCString();
    const seconds = parseRetryAfterSeconds({'retry-after': value});
    expect(seconds).toBeDefined();
    expect(seconds!).toBeGreaterThanOrEqual(2);
    expect(seconds!).toBeLessThanOrEqual(4);
  });

  it('returns undefined for unparseable value', () => {
    expect(parseRetryAfterSeconds({'retry-after': 'not-a-number'})).toBeUndefined();
  });

  it('uses first value when header is array', () => {
    expect(parseRetryAfterSeconds({'retry-after': ['3', '5']})).toBe(3);
  });
});

describe('buildBackoffScheduleSeconds', () => {
  it('builds exponential schedule by default', () => {
    const schedule = buildBackoffScheduleSeconds(3, {baseDelay: 1, factor: 2});
    expect(schedule).toHaveLength(3);
    // attempt 1..3 => base * factor^(attempt-1) => 1, 2, 4
    expect(schedule[0]).toBe(1);
    expect(schedule[1]).toBe(2);
    expect(schedule[2]).toBe(4);
  });

  it('builds linear schedule when strategy is linear', () => {
    const schedule = buildBackoffScheduleSeconds(3, {
      strategy: 'linear',
      baseDelay: 1,
    });
    expect(schedule).toEqual([1, 2, 3]);
  });

  it('clamps by maxDelay', () => {
    const schedule = buildBackoffScheduleSeconds(5, {
      baseDelay: 10,
      factor: 2,
      maxDelay: 25,
    });
    expect(schedule.every(s => s <= 25)).toBe(true);
  });
});

describe('resolveRetriesScheduleSeconds', () => {
  const policy = {retries: undefined as unknown as number, backoff: undefined};

  it('throws on invalid retries shorthand', () => {
    expect(() => resolveRetriesScheduleSeconds({...policy, retries: 'bad'})).toThrow(
      /Invalid retries shorthand/,
    );
  });

  it('returns empty array when no retries', () => {
    expect(resolveRetriesScheduleSeconds({})).toEqual([]);
    expect(resolveRetriesScheduleSeconds({retries: undefined})).toEqual([]);
  });

  it('returns slice of array when retries is array', () => {
    expect(resolveRetriesScheduleSeconds({retries: [1, 2, 3]})).toEqual([1, 2, 3]);
  });
});

describe('applyJitterSeconds', () => {
  it('returns 0 when delaySeconds <= 0', () => {
    expect(applyJitterSeconds(0, 1, undefined)).toBe(0);
    expect(applyJitterSeconds(-1, 1, undefined)).toBe(0);
  });

  it('uses custom jitter function when provided', () => {
    const custom = vi.fn((d: number) => d * 2);
    expect(applyJitterSeconds(5, 1, custom)).toBe(10);
    expect(custom).toHaveBeenCalledWith(5, 1);
  });

  it('returns original delay when jitter function returns invalid value', () => {
    expect(applyJitterSeconds(5, 1, () => -1)).toBe(5);
    expect(applyJitterSeconds(5, 1, () => NaN)).toBe(5);
  });

  it('applies ratio jitter within bounds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = applyJitterSeconds(10, 1, 0.2);
    expect(result).toBeGreaterThanOrEqual(8);
    expect(result).toBeLessThanOrEqual(12);
    vi.restoreAllMocks();
  });
});

describe('sleepMs', () => {
  it('resolves immediately when delayMs <= 0', async () => {
    await expect(sleepMs(0)).resolves.toBeUndefined();
    await expect(sleepMs(-1)).resolves.toBeUndefined();
  });

  it('rejects with AbortError when signal already aborted', async () => {
    const c = new AbortController();
    c.abort();
    await expect(sleepMs(1000, c.signal)).rejects.toMatchObject({name: 'AbortError'});
  });

  it('rejects when signal aborts during wait', async () => {
    vi.useFakeTimers();
    const c = new AbortController();
    const p = sleepMs(10_000, c.signal);
    c.abort();
    await expect(p).rejects.toMatchObject({name: 'AbortError'});
    vi.useRealTimers();
  });

  it('resolves after delay when no signal', async () => {
    vi.useFakeTimers();
    const p = sleepMs(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('resolves after delay when signal provided but not aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const p = sleepMs(100, controller.signal);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe('parseRouteMethod', () => {
  it('extracts method from string route', () => {
    expect(parseRouteMethod('GET /path')).toBe('GET');
    expect(parseRouteMethod('  POST   /path')).toBe('POST');
  });

  it('returns method from object route', () => {
    expect(parseRouteMethod({method: 'PUT', url: 'https://a/p'})).toBe('PUT');
  });
});

describe('isIdempotentMethod', () => {
  it('returns true for GET, HEAD, PUT, DELETE, OPTIONS, TRACE', () => {
    expect(isIdempotentMethod('GET')).toBe(true);
    expect(isIdempotentMethod('head')).toBe(true);
    expect(isIdempotentMethod('PUT')).toBe(true);
    expect(isIdempotentMethod('DELETE')).toBe(true);
    expect(isIdempotentMethod('OPTIONS')).toBe(true);
    expect(isIdempotentMethod('TRACE')).toBe(true);
  });

  it('returns false for POST, PATCH', () => {
    expect(isIdempotentMethod('POST')).toBe(false);
    expect(isIdempotentMethod('PATCH')).toBe(false);
  });
});

describe('isAbortError', () => {
  it('returns true for error with name AbortError', () => {
    expect(isAbortError(Object.assign(new Error('x'), {name: 'AbortError'}))).toBe(true);
  });

  it('returns false for normal Error or null', () => {
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
