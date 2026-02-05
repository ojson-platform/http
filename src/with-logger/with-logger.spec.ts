import type {BoundHttpClient, HttpClient, RequestOptions, ResponseData} from '../types';

import {describe, expect, it, vi} from 'vitest';

import {RequestError} from '../client/request';

import {withLogger} from './with-logger';

const createClient = (input?: {
  endpointImpl?: BoundHttpClient['endpoint'];
  requestImpl?: BoundHttpClient['request'];
}): HttpClient => {
  const endpoint =
    input?.endpointImpl ??
    vi.fn(() => ({
      method: 'GET',
      url: 'https://api.example.com/lists',
      headers: {
        authorization: 'Bearer secret',
        cookie: 'a=b',
      },
      body: undefined,
    }));

  const request =
    input?.requestImpl ??
    (vi.fn(async () => ({
      status: 200,
      url: 'https://api.example.com/lists',
      headers: {},
      data: null,
    })) as any);

  return {
    bind: vi.fn(() => ({
      endpoint: endpoint as BoundHttpClient['endpoint'],
      request: request as BoundHttpClient['request'],
    })),
  };
};

describe('withLogger', () => {
  it('is disabled by default when no logger is provided', async () => {
    const endpoint = vi.fn(() => ({
      method: 'GET',
      url: 'https://api.example.com/lists',
      headers: {},
      body: undefined,
    }));
    const baseRequest = vi.fn(
      async () => ({status: 200, url: '', headers: {}, data: null}) as ResponseData,
    );
    const client = createClient({
      endpointImpl: endpoint as any,
      requestImpl: baseRequest as any,
    });

    const wrapped = withLogger({
      include: {headers: true, resolvedUrl: true},
    })(client);
    await wrapped.bind({}).request('GET /lists');

    expect(endpoint).toHaveBeenCalledTimes(0);
    expect(baseRequest).toHaveBeenCalledTimes(1);
  });

  it('logs response success by default', async () => {
    const info = vi.fn();
    const client = createClient();

    const wrapped = withLogger({
      logger: {info},
    })(client);

    await wrapped.bind({}).request('GET /lists');

    expect(info).toHaveBeenCalledTimes(1);
    const [event, message] = info.mock.calls[0];
    expect(message).toBe('http.response');
    expect(event).toMatchObject({
      event: 'http.response',
      route: 'GET /lists',
      status: 200,
    });
  });

  it('redacts sensitive request headers when headers are included', async () => {
    const info = vi.fn();
    const client = createClient();

    const wrapped = withLogger({
      logger: {info},
      include: {headers: true},
    })(client);

    await wrapped.bind({}).request('GET /lists');

    const [event] = info.mock.calls[0];
    expect(event).toMatchObject({
      response: {headers: undefined},
      request: {
        headers: {
          authorization: '[REDACTED]',
          cookie: '[REDACTED]',
        },
      },
    });
  });

  it('does not call endpoint() when resolvedUrl and headers are disabled', async () => {
    const info = vi.fn();
    const endpoint = vi.fn(() => ({
      method: 'GET',
      url: 'https://api.example.com/lists',
      headers: {},
      body: undefined,
    }));
    const request = vi.fn(
      async () => ({status: 200, url: '', headers: {}, data: null}) as ResponseData,
    );
    const client = createClient({
      endpointImpl: endpoint as any,
      requestImpl: request as any,
    });

    const wrapped = withLogger({
      logger: {info},
      include: {resolvedUrl: false, headers: false},
    })(client);

    await wrapped.bind({}).request('GET /lists');

    expect(endpoint).toHaveBeenCalledTimes(0);
  });

  it('logs RequestError as warn for 4xx by default', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const warn = vi.fn();
    const request = vi.fn(async (_route: any, _options?: RequestOptions) => {
      vi.advanceTimersByTime(50);
      throw new RequestError('Request failed with status 404', {
        status: 404,
        request: {
          method: 'GET',
          url: 'https://api.example.com/lists',
          headers: {},
          body: undefined,
        },
        response: {
          status: 404,
          url: 'https://api.example.com/lists',
          headers: {},
          data: {error: 'nope'},
        },
      });
    });
    const client = createClient({requestImpl: request as any});

    const wrapped = withLogger({
      logger: {warn},
      include: {responseBody: true},
    })(client);

    await expect(wrapped.bind({}).request('GET /lists')).rejects.toBeInstanceOf(RequestError);

    expect(warn).toHaveBeenCalledTimes(1);
    const [event, message] = warn.mock.calls[0];
    expect(message).toBe('http.error');
    expect(event).toMatchObject({
      event: 'http.error',
      status: 404,
      durationMs: 50,
      response: {data: {error: 'nope'}},
    });

    vi.useRealTimers();
  });

  it('never throws when logger fails', async () => {
    const info = vi.fn(() => {
      throw new Error('logger down');
    });
    const request = vi.fn(
      async () => ({status: 200, url: '', headers: {}, data: null}) as ResponseData,
    );
    const client = createClient({requestImpl: request as any});

    const wrapped = withLogger({
      logger: {info},
    })(client);

    await expect(wrapped.bind({}).request('GET /lists')).resolves.toBeTruthy();
  });

  it('truncates large strings', async () => {
    const info = vi.fn();
    const request = vi.fn(async () => ({
      status: 200,
      url: 'https://api.example.com/lists',
      headers: {},
      data: {text: 'x'.repeat(200)},
    }));
    const client = createClient({requestImpl: request as any});

    const wrapped = withLogger({
      logger: {info},
      include: {responseBody: true},
      maxStringLength: 64,
    })(client);

    await wrapped.bind({}).request('GET /lists');

    const [event] = info.mock.calls[0];
    expect((event as any).response.data.text).toContain('…(truncated');
  });

  it('includes ctxFields and response headers in error log when configured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const errorFn = vi.fn();
    const request = vi.fn(async () => {
      vi.advanceTimersByTime(10);
      throw new RequestError('fail', {
        status: 502,
        request: {method: 'GET', url: 'https://api.example.com/lists', headers: {}},
        response: {
          status: 502,
          url: 'https://api.example.com/lists',
          headers: {'x-server': 'down'},
          data: null,
        },
      });
    });
    const client = createClient({requestImpl: request as any});

    const wrapped = withLogger({
      logger: {error: errorFn},
      include: {headers: true},
      getFields: (ctx: {requestId?: string}) =>
        ctx.requestId ? {requestId: ctx.requestId} : undefined,
    })(client);

    await expect(wrapped.bind({requestId: 'req-1'}).request('GET /lists')).rejects.toBeInstanceOf(
      RequestError,
    );

    expect(errorFn).toHaveBeenCalledTimes(1);
    const [event] = errorFn.mock.calls[0];
    expect(event).toMatchObject({
      event: 'http.error',
      requestId: 'req-1',
      response: {headers: {['x-server']: 'down'}},
    });
    vi.useRealTimers();
  });

  it('logs request body when include.requestBody is true', async () => {
    const info = vi.fn();
    const request = vi.fn(
      async () => ({status: 200, url: '', headers: {}, data: null}) as ResponseData,
    );
    const client = createClient({requestImpl: request as any});

    const wrapped = withLogger({
      logger: {info},
      include: {requestBody: true},
    })(client);

    await wrapped.bind({}).request('POST /lists', {body: {name: 'todo'}});

    const [event] = info.mock.calls[0];
    expect(event.request?.body).toEqual({name: 'todo'});
  });

  it('logs request start when include.requestStart is true and level allows debug', async () => {
    const debug = vi.fn();
    const info = vi.fn();
    const client = createClient();

    const wrapped = withLogger({
      logger: {debug, info},
      include: {requestStart: true},
      level: 'debug',
    })(client);

    await wrapped.bind({}).request('GET /lists');

    expect(debug).toHaveBeenCalledTimes(1);
    const [event, message] = debug.mock.calls[0];
    expect(message).toBe('http.request');
    expect(event).toMatchObject({event: 'http.request', route: 'GET /lists'});
  });
});
