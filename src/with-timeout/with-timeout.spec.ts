import type {BoundHttpClient, HttpClient, ResponseData} from '../types';

import {describe, expect, it, vi} from 'vitest';

import {withTimeout} from './with-timeout';

const createClient = (requestImpl?: BoundHttpClient['request']): HttpClient => {
  const request =
    requestImpl ?? (async () => ({status: 200, url: '', headers: {}, data: null}) as ResponseData);

  return {
    bind: vi.fn(() => ({
      endpoint: vi.fn(),
      request: vi.fn(request) as BoundHttpClient['request'],
    })),
  };
};

describe('withTimeout', () => {
  it('applies default timeout when missing', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout(123)(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({timeout: 123});
  });

  it('clamps timeout by ctx.deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({defaultTimeout: 10_000})(client);

    const result = await wrapped.bind({deadline: 1500}).request('GET /lists');

    expect(result.data).toMatchObject({timeout: 500});
    vi.useRealTimers();
  });

  it('does not exceed ctx.deadline even when request timeout is larger', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({})(client);

    const result = await wrapped.bind({deadline: 1600}).request('GET /lists', {timeout: 9999});

    expect(result.data).toMatchObject({timeout: 600});
    vi.useRealTimers();
  });

  it('fails fast when deadline is exceeded', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const baseRequest = vi.fn(async () => ({status: 200, url: '', headers: {}, data: null}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({})(client);

    await expect(wrapped.bind({deadline: 900}).request('GET /lists')).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(baseRequest).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('adds deadline header in relative-ms mode', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({
      deadlineHeader: 'x-timeout-ms,relative-ms',
    })(client);

    const result = await wrapped.bind({deadline: 1800}).request('GET /lists');

    expect(result.data).toMatchObject({
      headers: {'x-timeout-ms': '800'},
    });
    vi.useRealTimers();
  });

  it('respects existing header when configured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({
      deadlineHeader: {
        name: 'x-timeout-ms',
        mode: 'relative-ms',
        respectExisting: true,
      },
    })(client);

    const result = await wrapped.bind({deadline: 1800}).request('GET /lists', {
      headers: {'x-timeout-ms': 'manual'},
    });

    expect(result.data).toMatchObject({
      headers: {'x-timeout-ms': 'manual'},
    });
    vi.useRealTimers();
  });

  it('uses getDeadline from options when provided', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({
      defaultTimeout: 10_000,
      getDeadline: () => 1500,
    })(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({timeout: 500});
    vi.useRealTimers();
  });

  it('adds deadline header in absolute-ms mode', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({
      deadlineHeader: {name: 'x-deadline', mode: 'absolute-ms'},
    })(client);

    const result = await wrapped.bind({deadline: 1800}).request('GET /lists');

    expect(result.data).toMatchObject({
      headers: {'x-deadline': '1800'},
    });
    vi.useRealTimers();
  });

  it('clamps effective timeout by minTimeout when remaining is small', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTimeout({minTimeout: 5})(client);

    const result = await wrapped.bind({deadline: 1000.002}).request('GET /lists');

    expect(result.data).toMatchObject({timeout: 5});
    vi.useRealTimers();
  });
});
