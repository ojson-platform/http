import type {
  EndpointResult,
  FetchImpl,
  RequestErrorShape,
  RequestOptions,
  RequestRoute,
  ResponseData,
} from '../types';

import {normalizeHeaders, normalizeRequestOptions} from '../utils';

import {endpoint} from './endpoint';

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as {name?: string}).name === 'AbortError';
};

const readResponseHeaders = (response: Response): ResponseData['headers'] => {
  const headers: ResponseData['headers'] = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
};

const shouldParseJson = (contentType?: string | null): boolean => {
  if (!contentType) {
    return false;
  }

  const normalized = contentType.toLowerCase();
  return normalized.includes('application/json') || normalized.includes('+json');
};

const parseResponseData = async (response: Response, parseBody: boolean): Promise<unknown> => {
  if (!parseBody) {
    return null;
  }

  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (shouldParseJson(contentType)) {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  return await response.text();
};

const createAbortSignal = (
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): {signal?: AbortSignal; cleanup: () => void} => {
  if (!signal && !timeout) {
    return {cleanup: () => undefined};
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
    }
  }

  if (timeout && timeout > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
};

/**
 * Error thrown when a request fails or returns a non-2xx response.
 */
export class RequestError extends Error implements RequestErrorShape {
  status?: number;
  request: RequestErrorShape['request'];
  response?: RequestErrorShape['response'];

  constructor(
    message: string,
    input: {
      status?: number;
      request: RequestErrorShape['request'];
      response?: RequestErrorShape['response'];
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'RequestError';
    this.status = input.status;
    this.request = input.request;
    this.response = input.response;
    if (input.cause) {
      (this as Error & {cause?: unknown}).cause = input.cause;
    }
  }
}

const buildRequestInit = (result: EndpointResult): RequestInit => {
  const headerEntries: Array<[string, string]> = [];
  Object.entries(result.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(entry => headerEntries.push([key, entry]));
      return;
    }

    headerEntries.push([key, value]);
  });

  const init: RequestInit = {
    method: result.method,
    headers: headerEntries,
  };

  if (result.body !== undefined) {
    init.body = result.body as BodyInit;
  }

  return init;
};

/**
 * Execute a request for the given route.
 * @param route Request route in "METHOD /path" or object form.
 * @param options Request options such as headers, body, timeout.
 * @param input Internal config for fetch implementation and base URL.
 * @returns Response data with status, headers, and parsed body.
 */
export const request = async (
  route: RequestRoute,
  options: RequestOptions = {},
  input?: {fetch?: FetchImpl; baseUrl?: string},
): Promise<ResponseData> => {
  const normalized = normalizeRequestOptions(options);
  const baseUrl = normalized.baseUrl ?? input?.baseUrl;
  const result = endpoint(route, {...normalized, baseUrl});
  const {cleanup, signal} = createAbortSignal(options.signal, options.timeout);
  const init = buildRequestInit(result);

  if (signal) {
    init.signal = signal;
  }

  const fetchImpl = input?.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('Fetch implementation is required.');
  }

  try {
    const response = await fetchImpl(result.url, init);
    const headers = readResponseHeaders(response);
    const data = await parseResponseData(response, options.parseSuccessResponseBody !== false);
    const responseData: ResponseData = {
      status: response.status,
      url: response.url || result.url,
      headers,
      data,
    };

    if (response.status >= 400) {
      throw new RequestError(`Request failed with status ${response.status}`, {
        status: response.status,
        request: {
          method: result.method,
          url: result.url,
          headers: normalizeHeaders(result.headers),
          body: result.body,
        },
        response: responseData,
      });
    }

    return responseData;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (error instanceof RequestError) {
      throw error;
    }

    throw new RequestError('Request failed', {
      request: {
        method: result.method,
        url: result.url,
        headers: normalizeHeaders(result.headers),
        body: result.body,
      },
      cause: error,
    });
  } finally {
    cleanup();
  }
};
