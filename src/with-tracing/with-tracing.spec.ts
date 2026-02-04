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
});
