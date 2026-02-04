import type {HttpWrapper, RequestOptions} from '../types';

export type DeadlineHeaderMode = 'absolute-ms' | 'relative-ms';

export type DeadlineHeaderConfig = {
  name: string;
  mode?: DeadlineHeaderMode;
  respectExisting?: boolean;
};

export type WithTimeoutOptions = {
  defaultTimeout?: number;
  propagateDeadline?: boolean;
  minTimeout?: number;
  getDeadline?: (ctx: unknown) => number | undefined;
  deadlineHeader?: string | DeadlineHeaderConfig;
};

export type WithTimeoutArg = WithTimeoutOptions | number;

export type WithTimeoutState = {
  ctx: unknown;
  options: WithTimeoutOptions;
};

export type TimeoutApplyResult = {
  options: RequestOptions;
  remainingMs?: number;
};

export type WithTimeoutWrapper = (arg?: WithTimeoutArg) => HttpWrapper;
