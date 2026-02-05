import {describe, expect, it, vi} from 'vitest';

import {
  RequestError,
  compose,
  http,
  withAuth,
  withLogger,
  withRetry,
  withTimeout,
  withTracing,
} from '.';

const headersToObject = (headers: RequestInit['headers']): Record<string, string> => {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return headers as Record<string, string>;
};

describe('integration helpers', () => {
  it('throws when bind is called with undefined ctx', () => {
    const client = http({endpoint: 'https://api.test'});
    expect(() => client.bind(undefined as unknown as Record<string, never>)).toThrow(
      'http.bind(ctx) requires a non-undefined ctx value.',
    );
  });

  it('preserves withAuth when composed with withLogger', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = headersToObject(init?.headers);
      expect(headers.authorization).toBe('Bearer token-1');
      return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    });

    const client = compose(
      http,
      withAuth(ctx => ({headers: {authorization: `Bearer ${ctx.token}`}})),
      withLogger({logger: {info: vi.fn()}}),
    )({endpoint: 'https://api.example.com', fetch});

    await client.bind({token: 'token-1'}).request('GET /lists');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves withRetry when composed with withLogger', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
      if (fetch.mock.calls.length === 1) {
        return new Response('fail', {status: 503});
      }
      return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    });

    const client = compose(
      http,
      withRetry({retries: 1, jitter: 0}),
      withLogger({logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn()}}),
    )({endpoint: 'https://api.example.com', fetch});

    const result = await client.bind({}).request('GET /lists');
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('still bubbles RequestError when retries are disabled', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response('fail', {status: 503});
    });

    const client = compose(
      http,
      withRetry({retries: 0}),
      withLogger({logger: {error: vi.fn()}}),
    )({endpoint: 'https://api.example.com', fetch});

    await expect(client.bind({}).request('GET /lists')).rejects.toBeInstanceOf(RequestError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('composes auth, tracing, timeout, retry, and logger together', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = headersToObject(init?.headers);
      expect(headers.authorization).toBe('Bearer token-2');
      expect(headers['x-request-id']).toBe('req-2');
      expect(init?.signal).toBeInstanceOf(AbortSignal);

      if (fetch.mock.calls.length === 1) {
        return new Response('fail', {status: 503});
      }
      return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    });

    const logger = {info: vi.fn(), warn: vi.fn(), error: vi.fn()};
    const client = compose(
      http,
      withAuth(ctx => ({headers: {authorization: `Bearer ${ctx.token}`}})),
      withTracing({getId: () => 'req-2'}),
      withTimeout({defaultTimeout: 50}),
      withRetry({retries: 1, jitter: 0}),
      withLogger({logger, include: {headers: true}}),
    )({endpoint: 'https://api.example.com', fetch});

    const result = await client.bind({token: 'token-2'}).request('GET /lists');
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalled();
  });
});
