import type {Expect, Equal} from './__tests__/type-tests-helpers';
import type {HttpClient} from './types';

import {describe, it} from 'vitest';

import {compose, http, withAuth, withLogger, withRetry, withTimeout, withTracing} from '.';
import {expectType} from './__tests__/type-tests-helpers';

type BindCtx<T> = T extends {bind: (ctx: infer C, ...args: any[]) => any} ? C : never;

describe('Type Tests', () => {
  it('infers ctx from a single wrapper', () => {
    const client = compose(
      http,
      withAuth((ctx: {token: string}) => ({headers: {authorization: `Bearer ${ctx.token}`}})),
    )({endpoint: 'https://api.example.com'});
    expectType<typeof client>(client);

    type Ctx = BindCtx<typeof client>;
    void (null as Expect<Equal<Ctx, {token: string}>>);

    const bound = client.bind({token: 'secret'});
    expectType<HttpClient['bind']>(client.bind);
    expectType<Promise<unknown>>(bound.request('GET /lists'));
  });

  it('infers ctx as an intersection across wrappers', () => {
    const client = compose(
      http,
      withAuth((ctx: {token: string}) => ({headers: {authorization: `Bearer ${ctx.token}`}})),
      withTracing({getId: (ctx: {requestId: string}) => ctx.requestId}),
    )({endpoint: 'https://api.example.com'});
    expectType<typeof client>(client);

    type Ctx = BindCtx<typeof client>;
    void (null as Expect<Equal<Ctx, {token: string} & {requestId: string}>>);
  });

  it('keeps ctx unchanged for wrappers without ctx requirements', () => {
    const client = compose(
      http,
      withTimeout({defaultTimeout: 100}),
      withRetry({retries: 1, jitter: 0}),
    )({endpoint: 'https://api.example.com'});
    expectType<typeof client>(client);

    type Ctx = BindCtx<typeof client>;
    void (null as Expect<Equal<Ctx, unknown>>);
  });

  it('infers ctx from logger fields', () => {
    const client = compose(
      http,
      withLogger({
        getFields: (ctx: {requestId: string}) => ({requestId: ctx.requestId}),
      }),
    )({endpoint: 'https://api.example.com'});
    expectType<typeof client>(client);

    type Ctx = BindCtx<typeof client>;
    void (null as Expect<Equal<Ctx, {requestId: string}>>);
  });
});
