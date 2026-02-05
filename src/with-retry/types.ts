import type {RequestError} from '../client/request';
import type {RequestRoute} from '../types';

/**
 * Backoff strategy.
 */
export type BackoffStrategy = 'exp' | 'linear';

/**
 * Backoff configuration (used for number or shorthand schedules).
 */
export type BackoffOptions = {
  /**
   * Backoff strategy.
   */
  strategy?: BackoffStrategy;
  /**
   * Base delay in seconds (attempt #1).
   */
  baseDelay?: number;
  /**
   * Max delay cap in seconds.
   */
  maxDelay?: number;
  /**
   * Exponential factor.
   */
  factor?: number;
};

/**
 * Retry budget preset.
 */
export type RetryBudgetPreset = 'off' | 'conservative' | 'balanced' | 'aggressive';

/**
 * Retry budget configuration.
 */
export type RetryBudgetConfig = {
  /**
   * Maximum token capacity.
   */
  maxTokens?: number;
  /**
   * Tokens refilled on success.
   */
  refillOnSuccess?: number;
  /**
   * Tokens consumed per retry.
   */
  costPerRetry?: number;
};

/**
 * Retry budget shorthand or config.
 */
export type RetryBudget =
  | RetryBudgetPreset
  | `budget,${number},${number},${number}`
  | RetryBudgetConfig;

/**
 * Options for withRetry.
 */
export type WithRetryOptions = {
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
