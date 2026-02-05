import type {BoundHttpClient, HttpClient, ResponseData} from '../types';

import {describe, expect, it, vi} from 'vitest';

import {withTracing} from './with-tracing';

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

describe('withTracing', () => {
  it('adds correlation id header when missing', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);

    const wrapped = withTracing({
      headerName: 'x-request-id',
      getId: () => 'req-1',
    })(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({headers: {'x-request-id': 'req-1'}});
  });

  it('does not overwrite an existing correlation header', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);

    const wrapped = withTracing({
      headerName: 'x-request-id',
      getId: () => 'req-1',
    })(client);

    const result = await wrapped.bind({}).request('GET /lists', {
      headers: {'x-request-id': 'manual'},
    });

    expect(result.data).toMatchObject({headers: {'x-request-id': 'manual'}});
  });

  it('ignores getId errors', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);

    const wrapped = withTracing({
      getId: async () => {
        throw new Error('boom');
      },
    })(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({headers: {}});
  });

  it('does not add header when opts has no getId', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTracing({})(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({headers: {}});
  });

  it('does not add header when getId returns non-string', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withTracing({
      getId: () => 123 as unknown as string,
    })(client);

    const result = await wrapped.bind({}).request('GET /lists');

    expect(result.data).toMatchObject({headers: {}});
  });

  it('does not add header when getId returns null or empty string', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);

    const wrappedNull = withTracing({
      headerName: 'x-request-id',
      getId: () => null,
    })(client);
    const resultNull = await wrappedNull.bind({}).request('GET /lists');
    expect(resultNull.data).toMatchObject({headers: {}});

    const wrappedEmpty = withTracing({
      headerName: 'x-request-id',
      getId: () => '',
    })(client);
    const resultEmpty = await wrappedEmpty.bind({}).request('GET /lists');
    expect(resultEmpty.data).toMatchObject({headers: {}});
  });
});
