import type {RequestError} from '../client/request';
import type {HttpWrapper, RequestRoute} from '../types';

export type BackoffStrategy = 'exp' | 'linear';

export type BackoffOptions = {
  strategy?: BackoffStrategy;
  baseDelay?: number; // seconds
  maxDelay?: number; // seconds
  factor?: number;
};

export type RetryBudgetPreset = 'off' | 'conservative' | 'balanced' | 'aggressive';

export type RetryBudgetConfig = {
  maxTokens?: number;
  refillOnSuccess?: number;
  costPerRetry?: number;
};

export type RetryBudget =
  | RetryBudgetPreset
  | `budget,${number},${number},${number}`
  | RetryBudgetConfig;

export type RetryPolicy = {
  /**
   * Retry configuration.
   *
   * - `number`: number of retries with a generated backoff schedule.
   * - `number[]`: explicit delay schedule in seconds.
   * - `string`: shorthand schedule, for example `exp,1,3` (3 retries, 1s base, exponential).
   */
  retries?: number | number[] | string;

  /**
   * Backoff parameters used when `retries` is a `number` or a shorthand `string`.
   */
  backoff?: BackoffOptions;

  /**
   * Jitter configuration to avoid synchronized retries.
   *
   * - `number`: ratio in range [0..1]. The actual delay becomes `delay ± delay*jitter`.
   * - `function`: custom delay randomization (seconds).
   *
   * Default: `0.2` (20% jitter).
   */
  jitter?: number | ((delaySeconds: number, attempt: number) => number);

  /**
   * Retry budget (token-bucket style).
   */
  budget?: RetryBudget;

  /**
   * Custom retry predicate.
   */
  shouldRetry?: (error: RequestError, meta: {route: RequestRoute; attempt: number}) => boolean;

  /**
   * Retry non-idempotent methods.
   * Default: false
   */
  allowNonIdempotent?: boolean;
};

export type WithRetryWrapper = (policy?: RetryPolicy) => HttpWrapper;
