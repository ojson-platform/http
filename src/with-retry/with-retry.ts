import type {
  BoundHttpClient,
  HttpClient,
  HttpConfig,
  HttpWrapper,
  RequestOptions,
  RequestRoute,
} from '../types';
import type {RetryBudgetConfig, WithRetryOptions} from './types';

import {RequestError} from '../client/request';

import {
  applyJitterSeconds,
  DEFAULT_BUDGET,
  isAbortError,
  isIdempotentMethod,
  parseBudget,
  parseRetryAfterSeconds,
  parseRouteMethod,
  resolveRetriesScheduleSeconds,
  sleepMs,
} from './utils';

const __WithRetry__ = Symbol('WithRetry');
const __WithRetryBudget__ = Symbol('WithRetryBudget');

type BudgetState = {
  tokens: number;
  config: Required<RetryBudgetConfig>;
};

type WithRetryClient = HttpClient & {
  [__WithRetry__]?: WithRetryOptions;
  [__WithRetryBudget__]?: BudgetState;
};

const ensureBudget = (client: WithRetryClient): BudgetState | undefined => {
  const parsed = parseBudget(client[__WithRetry__]?.budget);
  if (!parsed) {
    return undefined;
  }

  const resolved: Required<RetryBudgetConfig> = {
    ...DEFAULT_BUDGET,
    ...parsed,
  };

  const existing = client[__WithRetryBudget__];
  if (existing) {
    return existing;
  }

  const state: BudgetState = {
    tokens: resolved.maxTokens,
    config: resolved,
  };
  client[__WithRetryBudget__] = state;
  return state;
};

const refillBudgetOnSuccess = (budget: BudgetState | undefined) => {
  if (!budget) {
    return;
  }

  budget.tokens = Math.min(budget.config.maxTokens, budget.tokens + budget.config.refillOnSuccess);
};

const consumeBudgetForRetry = (budget: BudgetState | undefined): boolean => {
  if (!budget) {
    return true;
  }

  if (budget.tokens < budget.config.costPerRetry) {
    return false;
  }

  budget.tokens -= budget.config.costPerRetry;
  return true;
};

const shouldRetryError = (
  policy: WithRetryOptions,
  error: RequestError,
  meta: {route: RequestRoute; attempt: number},
) => {
  if (policy.shouldRetry) {
    return Boolean(policy.shouldRetry(error, meta));
  }

  // Default: retry on network errors (no status) or 5xx and 429
  const status = error.status;
  if (status === undefined) {
    return true;
  }

  if (status === 429) {
    return true;
  }

  return status >= 500;
};

/** Returns delay in ms if we should retry, null if caller should throw. */
const computeRetryDelayMs = (
  error: RequestError,
  policy: WithRetryOptions,
  budgetState: BudgetState | undefined,
  route: RequestRoute,
  attempt: number,
  scheduleSeconds: number[],
): number | null => {
  if (!shouldRetryError(policy, error, {route, attempt})) {
    return null;
  }
  if (attempt >= scheduleSeconds.length || !consumeBudgetForRetry(budgetState)) {
    return null;
  }
  const retryAfterSeconds =
    error.status === 429 || error.status === 503
      ? parseRetryAfterSeconds(error.response?.headers)
      : undefined;
  const baseDelay = retryAfterSeconds ?? scheduleSeconds[attempt];
  const delaySeconds = applyJitterSeconds(baseDelay, attempt + 1, policy.jitter);
  return Math.round(delaySeconds * 1000);
};

const wrapRequest = (
  request: BoundHttpClient['request'],
  policy: WithRetryOptions,
  budgetState?: BudgetState,
) =>
  async function (this: BoundHttpClient, route: RequestRoute, options?: RequestOptions) {
    const method = parseRouteMethod(route);
    const allowNonIdempotent = policy.allowNonIdempotent === true;
    if (!allowNonIdempotent && !isIdempotentMethod(method)) {
      return request.call(this, route, options);
    }

    const scheduleSeconds = resolveRetriesScheduleSeconds(policy, options?.retries);
    if (scheduleSeconds.length === 0) {
      return request.call(this, route, options);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= scheduleSeconds.length; attempt += 1) {
      try {
        const result = await request.call(this, route, options);
        refillBudgetOnSuccess(budgetState);
        return result;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        lastError = error;
        if (!(error instanceof RequestError)) {
          throw error;
        }
        const delayMs = computeRetryDelayMs(
          error,
          policy,
          budgetState,
          route,
          attempt,
          scheduleSeconds,
        );
        if (delayMs === null) {
          throw error;
        }
        await sleepMs(delayMs, options?.signal);
      }
    }

    throw lastError;
  };

const wrapBind = (bind: HttpClient['bind']) =>
  function (this: WithRetryClient, ctx: unknown, config?: HttpConfig) {
    const bound = bind.call(this, ctx, config);
    const policy = this[__WithRetry__] ?? {};
    const budget = ensureBudget(this);

    return {
      ...bound,
      request: wrapRequest(bound.request, policy, budget),
    };
  };

/**
 * Add retries to a client instance.
 *
 * - Retries are applied only for idempotent methods by default.
 * - Abort is never retried.
 * - Delay schedule supports `number[]`, `number` (backoff), and shorthand strings like `exp,1,3`.
 * - Supports jitter and `Retry-After` for 429/503.
 * - Optional token-bucket retry budget shared per wrapper instance.
 */
export const withRetry =
  (policy: WithRetryOptions = {}): HttpWrapper =>
  (client: HttpClient): HttpClient => {
    const wrapped: WithRetryClient = {
      ...client,
      bind: __WithRetry__ in client ? client.bind : wrapBind(client.bind),
      [__WithRetry__]: policy,
    };

    return wrapped;
  };
