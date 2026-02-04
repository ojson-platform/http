/**
 * Request route definition.
 */
export type RequestRoute =
  | string
  | {
      method: string;
      url: string;
    };

/**
 * Header value that may be single or multi-valued.
 */
export type HeaderValue = string | string[];

/**
 * Normalized headers map.
 */
export type HeadersMap = Record<string, HeaderValue>;

/**
 * Supported header input formats.
 */
export type HeadersInput = HeadersMap | [string, string][];

/**
 * Options for building an endpoint.
 */
export type EndpointOptions = {
  baseUrl?: string;
  headers?: HeadersInput;
  query?: Record<string, string | number | boolean | (string | number | boolean)[]>;
  params?: Record<string, string | number>;
  body?: unknown;
  data?: unknown;
};

/**
 * Options for executing a request.
 */
export type RequestOptions = EndpointOptions & {
  ctx?: unknown;
  signal?: AbortSignal;
  timeout?: number;
  retries?: number | number[];
  parseSuccessResponseBody?: boolean;
};

/**
 * Normalized endpoint data returned by endpoint().
 */
export type EndpointResult = {
  method: string;
  url: string;
  headers: HeadersMap;
  body?: unknown;
};

/**
 * Response data returned by request().
 */
export type ResponseData = {
  status: number;
  url: string;
  headers: HeadersMap;
  data: unknown;
};

/**
 * Error shape for request failures.
 */
export type RequestErrorShape = {
  status?: number;
  request: {
    method: string;
    url: string;
    headers: HeadersMap;
    body?: unknown;
  };
  response?: {
    status: number;
    url: string;
    headers: HeadersMap;
    data?: unknown;
  };
};

/**
 * Declarative configuration merged into requests.
 */
export type HttpConfig = {
  headers?: HeadersInput;
  timeout?: number;
  retries?: number | number[];
};

/**
 * Fetch implementation signature.
 */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Options for creating a base client.
 */
export type HttpOptions = {
  endpoint: string;
  fetch?: FetchImpl;
  config?: HttpConfig;
};

/**
 * Base HTTP client interface.
 *
 * ADR: docs/ADR/0004-httpclient-ctx-generic.md
 */
export type HttpClient<CTX = unknown> = {
  bind: (this: HttpClient<CTX>, ctx: CTX, config?: HttpConfig) => BoundHttpClient;
};

/**
 * Wrapper signature for HTTP client extensions.
 *
 * ADR: docs/ADR/0004-httpclient-ctx-generic.md
 */
export type HttpWrapper<CTX = unknown> = (client: HttpClient<CTX>) => HttpClient<CTX>;

/**
 * HTTP client bound to a config.
 */
export type BoundHttpClient = {
  request: (
    this: BoundHttpClient,
    route: RequestRoute,
    options?: RequestOptions,
  ) => Promise<ResponseData>;
  endpoint: (
    this: BoundHttpClient,
    route: RequestRoute,
    options?: EndpointOptions,
  ) => EndpointResult;
};
