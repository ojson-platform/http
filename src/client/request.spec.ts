import {describe, expect, it, vi} from 'vitest';

import {RequestError, request} from './request';

describe('request', () => {
  it('returns response data for success', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    });

    const result = await request(
      'GET /lists',
      {baseUrl: 'https://api.test'},
      {
        fetch: fetchImpl,
      },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ok: true});
  });

  it('returns text for non-json responses', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('plain', {
        status: 200,
        headers: {'content-type': 'text/plain'},
      });
    });

    const result = await request('GET /lists', {baseUrl: 'https://api.test'}, {fetch: fetchImpl});

    expect(result.data).toBe('plain');
  });

  it('skips body parsing when parseSuccessResponseBody is false', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    });

    const result = await request(
      'GET /lists',
      {baseUrl: 'https://api.test', parseSuccessResponseBody: false},
      {fetch: fetchImpl},
    );

    expect(result.data).toBeNull();
  });

  it('throws RequestError on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({error: 'bad'}), {
        status: 400,
        headers: {'content-type': 'application/json'},
      });
    });

    await expect(
      request(
        'POST /lists',
        {baseUrl: 'https://api.test', body: {name: 'bad'}},
        {fetch: fetchImpl},
      ),
    ).rejects.toBeInstanceOf(RequestError);

    await expect(
      request(
        'POST /lists',
        {baseUrl: 'https://api.test', body: {name: 'bad'}},
        {fetch: fetchImpl},
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        status: 400,
      },
      request: {
        method: 'POST',
      },
    });
  });

  it('wraps network errors into RequestError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network');
    });

    await expect(
      request('GET /lists', {baseUrl: 'https://api.test'}, {fetch: fetchImpl}),
    ).rejects.toMatchObject({
      name: 'RequestError',
      request: {
        method: 'GET',
      },
    });
  });

  it('throws when fetch is not provided', async () => {
    const origFetch = globalThis.fetch;
    try {
      (globalThis as unknown as {fetch?: unknown}).fetch = undefined;
      await expect(
        request('GET /lists', {baseUrl: 'https://api.test'}, {}),
      ).rejects.toThrow('Fetch implementation is required.');
    } finally {
      (globalThis as unknown as {fetch: unknown}).fetch = origFetch;
    }
  });

  it('sends multi-value headers as multiple entries', async () => {
    let capturedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return new Response('ok', {status: 200});
    });

    await request(
      'GET /lists',
      {
        baseUrl: 'https://api.test',
        headers: {'x-custom': ['a', 'b']},
      },
      {fetch: fetchImpl},
    );

    expect(capturedInit?.headers).toBeDefined();
    const headers = capturedInit!.headers as Array<[string, string]>;
    const custom = headers.filter(([k]) => k.toLowerCase() === 'x-custom');
    expect(custom).toHaveLength(2);
    expect(custom.map(([, v]) => v)).toEqual(['a', 'b']);
  });

  it('propagates AbortError on timeout', async () => {
    vi.useFakeTimers();

    const fetchImpl = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          if (init?.signal?.aborted) {
            reject(Object.assign(new Error('aborted'), {name: 'AbortError'}));
            return;
          }
          init?.signal?.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('aborted'), {name: 'AbortError'})),
            {once: true},
          );
        }),
    );

    const promise = request(
      'GET /lists',
      {baseUrl: 'https://api.test', timeout: 10},
      {fetch: fetchImpl},
    );

    vi.advanceTimersByTime(20);

    await expect(promise).rejects.toMatchObject({name: 'AbortError'});

    vi.useRealTimers();
  });
});
