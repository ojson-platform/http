import type {HeadersMap, RequestOptions} from '../types';
import type {DeadlineHeaderConfig, DeadlineHeaderMode, WithTimeoutArg, WithTimeoutOptions} from './types';

import {hasHeader, isObject, mergeRequestOptions} from '../utils';

export const DEFAULT_WITH_TIMEOUT_OPTIONS: Required<
  Pick<WithTimeoutOptions, 'propagateDeadline' | 'minTimeout'>
> = {
  propagateDeadline: true,
  minTimeout: 1,
};

export const asOptions = (arg?: WithTimeoutArg): WithTimeoutOptions => {
  if (arg === undefined) {
    return {};
  }

  if (typeof arg === 'number') {
    return {defaultTimeout: arg};
  }

  return arg;
};

export const parseDeadlineHeader = (
  value: string | DeadlineHeaderConfig,
): DeadlineHeaderConfig => {
  if (typeof value !== 'string') {
    return value;
  }

  const [name, mode] = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  if (!name) {
    throw new Error('deadlineHeader shorthand requires a header name.');
  }

  if (mode && mode !== 'absolute-ms' && mode !== 'relative-ms') {
    throw new Error(`Invalid deadlineHeader mode "${mode}".`);
  }

  return {name, mode: (mode as DeadlineHeaderMode | undefined) ?? 'relative-ms'};
};

export const getDeadlineMs = (ctx: unknown, options: WithTimeoutOptions): number | undefined => {
  const byFn = options.getDeadline?.(ctx);
  if (typeof byFn === 'number' && Number.isFinite(byFn)) {
    return byFn;
  }

  if (isObject(ctx) && typeof ctx.deadline === 'number' && Number.isFinite(ctx.deadline)) {
    return ctx.deadline;
  }

  return undefined;
};

export const createAbortError = (message: string): Error => {
  const error = new Error(message);
  (error as Error & {name: string}).name = 'AbortError';
  return error;
};

export const clampMin = (value: number, min: number): number => (value < min ? min : value);

export const computeTimeoutMs = (
  ctx: unknown,
  requestOptions: RequestOptions | undefined,
  options: WithTimeoutOptions,
): {timeout?: number; remainingMs?: number; deadlineMs?: number} => {
  const resolved: WithTimeoutOptions = {
    ...DEFAULT_WITH_TIMEOUT_OPTIONS,
    ...options,
  };

  const minTimeout = resolved.minTimeout ?? DEFAULT_WITH_TIMEOUT_OPTIONS.minTimeout;
  const propagateDeadline =
    resolved.propagateDeadline ?? DEFAULT_WITH_TIMEOUT_OPTIONS.propagateDeadline;

  const baseTimeout = requestOptions?.timeout ?? resolved.defaultTimeout;

  if (!propagateDeadline) {
    return {timeout: baseTimeout};
  }

  const deadlineMs = getDeadlineMs(ctx, resolved);
  if (deadlineMs === undefined) {
    return {timeout: baseTimeout};
  }

  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) {
    return {timeout: 0, remainingMs, deadlineMs};
  }

  const clampedRemaining = clampMin(remainingMs, minTimeout);
  const timeout =
    baseTimeout === undefined ? clampedRemaining : Math.min(baseTimeout, clampedRemaining);
  return {timeout, remainingMs: clampedRemaining, deadlineMs};
};

export const withDeadlineHeader = (
  requestOptions: RequestOptions,
  deadlineMs: number,
  remainingMs: number,
  config: DeadlineHeaderConfig,
): RequestOptions => {
  const name = config.name.toLowerCase();
  const respectExisting = config.respectExisting ?? true;
  if (respectExisting && hasHeader(requestOptions.headers, name)) {
    return requestOptions;
  }

  const mode = config.mode ?? 'relative-ms';
  const value = mode === 'absolute-ms' ? String(deadlineMs) : String(remainingMs);
  const headers: HeadersMap = {[name]: value};
  return mergeRequestOptions(requestOptions, {headers});
};

