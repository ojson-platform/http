import type {HeadersMap, RequestRoute} from '../types';
import type {
  BackoffOptions,
  BackoffStrategy,
  RetryBudget,
  RetryBudgetConfig,
  RetryBudgetPreset,
  RetryPolicy,
} from './types';

const DEFAULT_JITTER = 0.2;

export const DEFAULT_BACKOFF: Required<BackoffOptions> = {
  strategy: 'exp',
  baseDelay: 1,
  maxDelay: 30,
  factor: 2,
};

export const DEFAULT_BUDGET: Required<RetryBudgetConfig> = {
  maxTokens: 10,
  refillOnSuccess: 0.1,
  costPerRetry: 1,
};

export const BUDGET_PRESETS: Record<
  Exclude<RetryBudgetPreset, 'off'>,
  Required<RetryBudgetConfig>
> = {
  conservative: {maxTokens: 5, refillOnSuccess: 0.05, costPerRetry: 1},
  balanced: {maxTokens: 10, refillOnSuccess: 0.1, costPerRetry: 1},
  aggressive: {maxTokens: 20, refillOnSuccess: 0.2, costPerRetry: 1},
};

export const isAbortError = (error: unknown): boolean =>
  Boolean(error) && typeof error === 'object' && (error as {name?: string}).name === 'AbortError';

export const parseRouteMethod = (route: RequestRoute): string => {
  if (typeof route !== 'string') {
    return String(route.method).toUpperCase();
  }

  const [maybeMethod] = route.trim().split(/\s+/, 1);
  return String(maybeMethod).toUpperCase();
};

export const isIdempotentMethod = (method: string): boolean => {
  const normalized = method.toUpperCase();
  return (
    normalized === 'GET' ||
    normalized === 'HEAD' ||
    normalized === 'PUT' ||
    normalized === 'DELETE' ||
    normalized === 'OPTIONS' ||
    normalized === 'TRACE'
  );
};

export const parseRetriesShorthand = (
  value: string,
): {strategy: BackoffStrategy; baseDelay: number; retries: number} | undefined => {
  const parts = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length !== 3) {
    return undefined;
  }

  const [strategyRaw, baseDelayRaw, retriesRaw] = parts;
  if (strategyRaw !== 'exp' && strategyRaw !== 'linear') {
    return undefined;
  }

  const baseDelay = Number.parseFloat(baseDelayRaw);
  const retries = Number.parseInt(retriesRaw, 10);
  if (!Number.isFinite(baseDelay) || baseDelay < 0) {
    return undefined;
  }
  if (!Number.isFinite(retries) || retries < 0) {
    return undefined;
  }

  return {strategy: strategyRaw, baseDelay, retries};
};

export const buildBackoffScheduleSeconds = (count: number, options?: BackoffOptions): number[] => {
  const resolved = {...DEFAULT_BACKOFF, ...(options ?? {})};
  const base = resolved.baseDelay;
  const max = resolved.maxDelay;
  const factor = resolved.factor;
  const strategy = resolved.strategy;

  return Array.from({length: count}, (_, idx) => {
    const attempt = idx + 1;
    const delay = strategy === 'linear' ? base * attempt : base * Math.pow(factor, attempt - 1);
    return Math.min(delay, max);
  });
};

export const resolveRetriesScheduleSeconds = (
  policy: RetryPolicy,
  requestRetries?: RetryPolicy['retries'],
): number[] => {
  const retries = requestRetries ?? policy.retries;
  if (!retries) {
    return [];
  }

  if (Array.isArray(retries)) {
    return retries.slice();
  }

  if (typeof retries === 'number') {
    const count = Math.max(0, Math.floor(retries));
    return buildBackoffScheduleSeconds(count, policy.backoff);
  }

  const parsed = parseRetriesShorthand(retries);
  if (!parsed) {
    throw new Error(`Invalid retries shorthand "${retries}".`);
  }

  return buildBackoffScheduleSeconds(parsed.retries, {
    ...policy.backoff,
    strategy: parsed.strategy,
    baseDelay: parsed.baseDelay,
  });
};

export const applyJitterSeconds = (
  delaySeconds: number,
  attempt: number,
  jitter: RetryPolicy['jitter'] | undefined,
): number => {
  if (delaySeconds <= 0) {
    return 0;
  }

  if (typeof jitter === 'function') {
    const next = jitter(delaySeconds, attempt);
    if (!Number.isFinite(next) || next < 0) {
      return delaySeconds;
    }

    return next;
  }

  const ratio = jitter === undefined ? DEFAULT_JITTER : jitter;
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return delaySeconds;
  }

  const clamped = Math.min(Math.max(ratio, 0), 1);
  const delta = delaySeconds * clamped;
  const min = Math.max(0, delaySeconds - delta);
  const max = delaySeconds + delta;
  return min + Math.random() * (max - min);
};

const firstHeaderValue = (headers: HeadersMap | undefined, name: string): string | undefined => {
  if (!headers) {
    return undefined;
  }

  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const parseRetryAfterSeconds = (headers?: HeadersMap): number | undefined => {
  const value = firstHeaderValue(headers, 'retry-after');
  if (!value) {
    return undefined;
  }

  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  }

  const dateMs = Date.parse(value);
  if (!Number.isFinite(dateMs)) {
    return undefined;
  }

  const diffMs = dateMs - Date.now();
  return Math.max(0, diffMs / 1000);
};

export const parseBudget = (budget: RetryBudget | undefined): RetryBudgetConfig | undefined => {
  if (!budget || budget === 'off') {
    return undefined;
  }

  if (typeof budget === 'string') {
    if (budget === 'conservative' || budget === 'balanced' || budget === 'aggressive') {
      return BUDGET_PRESETS[budget];
    }

    if (budget.startsWith('budget,')) {
      const parts = budget
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
      if (parts.length !== 4) {
        throw new Error(`Invalid budget shorthand "${budget}".`);
      }
      const maxTokens = Number.parseFloat(parts[1]);
      const refillOnSuccess = Number.parseFloat(parts[2]);
      const costPerRetry = Number.parseFloat(parts[3]);
      if (
        !Number.isFinite(maxTokens) ||
        !Number.isFinite(refillOnSuccess) ||
        !Number.isFinite(costPerRetry)
      ) {
        throw new Error(`Invalid budget shorthand "${budget}".`);
      }
      return {maxTokens, refillOnSuccess, costPerRetry};
    }

    throw new Error(`Invalid budget preset "${budget}".`);
  }

  return budget;
};

export const sleepMs = (delayMs: number, signal?: AbortSignal): Promise<void> => {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), {name: 'AbortError'}));
      return;
    }

    const id = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }

      resolve();
    }, delayMs);

    function onAbort() {
      clearTimeout(id);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }

      reject(Object.assign(new Error('Aborted'), {name: 'AbortError'}));
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, {once: true});
    }
  });
};
