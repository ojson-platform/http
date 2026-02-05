import type {BoundHttpClient, HttpClient, ResponseData} from '../types';

import {describe, expect, it, vi} from 'vitest';

import {RequestError} from '../client/request';

import {withRetry} from './with-retry';

const createError = (status?: number, headers?: Record<string, string>): RequestError => {
  return new RequestError('fail', {
    status,
    request: {method: 'GET', url: 'https://api.test/lists', headers: {}},
    response: status
      ? {
          status,
          url: 'https://api.test/lists',
          headers: headers ?? {},
          data: null,
        }
      : undefined,
  });
};

const createClient = (requestImpl: BoundHttpClient['request']): HttpClient => {
  return {
    bind: vi.fn(() => ({
      endpoint: vi.fn(),
      request: vi.fn(requestImpl) as BoundHttpClient['request'],
    })),
  };
};

describe('withRetry', () => {
  it('retries according to explicit schedule', async () => {
    vi.useFakeTimers();

    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(503))
      .mockResolvedValueOnce(response);

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [1], jitter: 0})(client);
    const promise = wrapped.bind({}).request('GET /lists');

    expect(baseRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(baseRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(baseRequest).toHaveBeenCalledTimes(2);

    await expect(promise).resolves.toMatchObject({status: 200});
    vi.useRealTimers();
  });

  it('does not retry AbortError', async () => {
    vi.useFakeTimers();

    const abortError = Object.assign(new Error('aborted'), {name: 'AbortError'});
    const baseRequest = vi.fn<BoundHttpClient['request']>().mockRejectedValue(abortError);

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [1]})(client);

    await expect(wrapped.bind({}).request('GET /lists')).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(baseRequest).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('does not retry non-idempotent methods by default', async () => {
    vi.useFakeTimers();

    const baseRequest = vi.fn<BoundHttpClient['request']>().mockRejectedValue(createError(503));
    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [1]})(client);

    await expect(wrapped.bind({}).request('POST /lists')).rejects.toBeInstanceOf(RequestError);
    expect(baseRequest).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('can retry non-idempotent methods when enabled', async () => {
    vi.useFakeTimers();

    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(503))
      .mockResolvedValueOnce(response);

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [0], allowNonIdempotent: true})(client);
    const promise = wrapped.bind({}).request('POST /lists');

    await expect(promise).resolves.toMatchObject({status: 200});
    expect(baseRequest).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('parses retries shorthand', async () => {
    vi.useFakeTimers();

    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(503))
      .mockResolvedValueOnce(response);

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: 'exp,0.001,1'})(client);
    const promise = wrapped.bind({}).request('GET /lists');

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({status: 200});
    expect(baseRequest).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('uses Retry-After for 429', async () => {
    vi.useFakeTimers();

    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(429, {'retry-after': '2'}))
      .mockResolvedValueOnce(response);

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [0.1], jitter: 0})(client);
    const promise = wrapped.bind({}).request('GET /lists');

    await vi.advanceTimersByTimeAsync(1999);
    expect(baseRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({status: 200});
    expect(baseRequest).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('applies jitter ratio within bounds', async () => {
    vi.useFakeTimers();

    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(503))
      .mockResolvedValueOnce(response);

    vi.spyOn(Math, 'random').mockReturnValue(0); // min bound

    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [1], jitter: 0.2})(client);
    const promise = wrapped.bind({}).request('GET /lists');

    // 1s with jitter 0.2 and random=0 => 0.8s
    await vi.advanceTimersByTimeAsync(799);
    expect(baseRequest).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(baseRequest).toHaveBeenCalledTimes(2);

    await expect(promise).resolves.toMatchObject({status: 200});
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('limits retries with budget', async () => {
    vi.useFakeTimers();

    const baseRequest = vi
      .fn<BoundHttpClient['request']>()
      .mockRejectedValueOnce(createError(503))
      .mockRejectedValueOnce(createError(503))
      .mockResolvedValueOnce({status: 200, url: '', headers: {}, data: null});

    const client = createClient(baseRequest);
    const wrapped = withRetry({
      retries: [0, 0],
      budget: {maxTokens: 1, costPerRetry: 1, refillOnSuccess: 0},
    })(client);

    await expect(wrapped.bind({}).request('GET /lists')).rejects.toBeInstanceOf(RequestError);
    expect(baseRequest).toHaveBeenCalledTimes(2); // initial + 1 retry, second retry skipped by budget
    vi.useRealTimers();
  });

  it('throws on invalid retries shorthand', async () => {
    const client = createClient(vi.fn());
    const wrapped = withRetry({retries: 'invalid-shorthand'})(client);

    await expect(wrapped.bind({}).request('GET /lists')).rejects.toThrow(
      /Invalid retries shorthand/,
    );
  });

  it('throws last error when all retries exhausted', async () => {
    vi.useFakeTimers();

    const err = createError(503);
    const baseRequest = vi.fn<BoundHttpClient['request']>().mockRejectedValue(err);
    const client = createClient(baseRequest);
    const wrapped = withRetry({retries: [0.001], jitter: 0})(client);
    const promise = wrapped.bind({}).request('GET /lists');
    const outcome = promise.then(() => null as unknown, (e: unknown) => e);

    await vi.advanceTimersByTimeAsync(2);
    const caught = await outcome;
    expect(caught).toBe(err);
    expect(baseRequest).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
