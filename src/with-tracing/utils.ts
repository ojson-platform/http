import type {RequestOptions} from '../types';
import type {TracingOptions} from './types';

import {hasHeader, mergeRequestOptions} from '../utils';

export const DEFAULT_HEADER_NAME = 'x-request-id';

export const getHeaderName = (opts: TracingOptions): string =>
  (opts.headerName ?? DEFAULT_HEADER_NAME).toLowerCase();

export const safeGetId = async (
  ctx: unknown,
  opts: TracingOptions,
): Promise<string | undefined> => {
  if (!opts.getId) {
    return undefined;
  }

  try {
    const value = await opts.getId(ctx);
    if (!value) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    if (!value.trim()) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
};

export const withCorrelationIdHeader = (
  options: RequestOptions,
  headerName: string,
  id: string | undefined,
): RequestOptions => {
  if (!id) {
    return options;
  }

  if (hasHeader(options.headers, headerName)) {
    return options;
  }

  return mergeRequestOptions(options, {headers: {[headerName]: id}});
};
