import {describe, expect, it} from 'vitest';

import {endpoint} from './endpoint';

describe('endpoint', () => {
  it('builds url with params and query and json body', () => {
    const result = endpoint('POST /lists/{id}', {
      baseUrl: 'https://api.test',
      params: {id: 42},
      query: {limit: 10, active: true, tags: ['a', 'b']},
      headers: {Authorization: 'Bearer token'},
      body: {name: 'todo'},
    });

    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://api.test/lists/42?limit=10&active=true&tags=a&tags=b');
    expect(result.headers['authorization']).toBe('Bearer token');
    expect(result.headers['content-type']).toBe('application/json');
    expect(result.body).toBe(JSON.stringify({name: 'todo'}));
  });

  it('uses data as raw body without content-type', () => {
    const result = endpoint('PUT /lists/1', {
      baseUrl: 'https://api.test',
      data: 'raw',
      body: {ignored: true},
    });

    expect(result.body).toBe('raw');
    expect(result.headers['content-type']).toBeUndefined();
  });

  it('preserves absolute urls with baseUrl provided', () => {
    const result = endpoint('GET https://other.test/items', {
      baseUrl: 'https://api.test',
    });

    expect(result.url).toBe('https://other.test/items');
  });

  it('accepts object route input', () => {
    const result = endpoint({method: 'get', url: '/lists'}, {baseUrl: 'https://api.test'});

    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://api.test/lists');
  });

  it('appends query to existing query string', () => {
    const result = endpoint('GET https://api.test/lists?existing=1', {
      query: {limit: 5},
    });

    expect(result.url).toBe('https://api.test/lists?existing=1&limit=5');
  });

  it('overrides existing query values', () => {
    const result = endpoint('GET /lists?var=a&keep=1', {
      query: {var: 'b'},
    });

    expect(result.url).toBe('/lists?keep=1&var=b');
  });

  it('throws on missing params', () => {
    expect(() =>
      endpoint('GET /lists/{id}', {
        baseUrl: 'https://api.test',
        params: {},
      }),
    ).toThrow('Missing param "id"');
  });
});
