import type {BoundHttpClient, HttpClient, ResponseData} from '../types';

import {describe, expect, it, vi} from 'vitest';

import {withAuth} from './with-auth';

const createClient = (requestImpl?: BoundHttpClient['request']): HttpClient => {
  const request = requestImpl ?? (async () => ({status: 200, url: '', headers: {}, data: null}));
  return {
    bind: vi.fn(() => ({
      endpoint: vi.fn(),
      request: vi.fn(request) as BoundHttpClient['request'],
    })),
  };
};

describe('withAuth', () => {
  it('passes bind ctx into the auth strategy', async () => {
    const ctx = {token: 'ctx-token'};
    const strategy = vi.fn(() => undefined);
    const client = createClient();
    const wrapped = withAuth(strategy)(client);

    await wrapped.bind(ctx).request('GET /lists');

    expect(strategy).toHaveBeenCalledWith(ctx);
  });

  it('merges auth options on top of request options by default', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withAuth(() => ({
      headers: {authorization: 'auth-token', 'x-extra': '1'},
    }))(client);

    const result = await wrapped.bind({}).request('GET /lists', {
      headers: {authorization: 'manual', 'x-client': '1'},
    });

    expect(result.data).toMatchObject({
      headers: {authorization: 'auth-token', 'x-client': '1', 'x-extra': '1'},
    });
  });

  it('merges query and params with auth taking precedence', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withAuth(() => ({
      query: {page: 2, limit: 50},
      params: {id: 'auth'},
    }))(client);

    const result = await wrapped.bind({}).request('GET /lists/{id}', {
      query: {page: 1, q: 'test'},
      params: {id: 'request'},
    });

    expect(result.data).toMatchObject({
      query: {page: 2, q: 'test', limit: 50},
      params: {id: 'auth'},
    });
  });

  it('uses auth body when both request and auth provide body', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withAuth(() => ({
      body: {name: 'auth'},
    }))(client);

    const result = await wrapped.bind({}).request('POST /lists', {
      body: {name: 'request'},
    });

    expect(result.data).toMatchObject({body: {name: 'auth'}});
  });

  it('uses auth data when both request and auth provide data', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withAuth(() => ({
      data: 'auth',
    }))(client);

    const result = await wrapped.bind({}).request('POST /lists', {
      data: 'request',
    });

    expect(result.data).toMatchObject({data: 'auth'});
  });

  it('merges auth options on top of request options', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const wrapped = withAuth(() => ({
      headers: {authorization: 'auth-token', 'x-extra': '1'},
    }))(client);

    const result = await wrapped.bind({}).request('GET /lists', {
      headers: {authorization: 'manual', 'x-client': '1'},
    });

    expect(result.data).toMatchObject({
      headers: {authorization: 'auth-token', 'x-client': '1', 'x-extra': '1'},
    });
  });

  it('overrides previously wrapped auth strategies', async () => {
    const response: ResponseData = {status: 200, url: '', headers: {}, data: null};
    const baseRequest = vi.fn(async (_route, options) => ({...response, data: options}));
    const client = createClient(baseRequest);
    const first = vi.fn(() => ({headers: {authorization: 'first'}}));
    const second = vi.fn(() => ({headers: {authorization: 'second'}}));

    const wrapped = withAuth(second)(withAuth(first)(client));
    const result = await wrapped.bind({}).request('GET /lists');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.data).toMatchObject({headers: {authorization: 'second'}});
  });
});
