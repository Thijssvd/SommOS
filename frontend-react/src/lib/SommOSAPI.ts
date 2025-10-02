export class SommOSAPIError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, { status, code, details }: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = 'SommOSAPIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RetryCondition = (error: Error | null, response: Response | null) => boolean;

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  jitter: boolean;
  retryCondition: RetryCondition;
}

function calculateRetryDelay(attempt: number, baseDelay = 1000, jitter = true): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const maxDelay = 10000;
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  if (!jitter) return Math.floor(cappedDelay);
  const jitterAmount = cappedDelay * 0.25;
  const jitteredDelay = cappedDelay + (Math.random() * 2 - 1) * jitterAmount;
  return Math.max(100, Math.floor(jitteredDelay));
}

async function fetchWithRetry(url: string, options: RequestInit & { retryConfig?: Partial<RetryConfig> } = {}): Promise<Response> {
  const DEFAULT_RETRY: RetryConfig = {
    retries: 3,
    retryDelay: 1000,
    jitter: true,
    retryCondition: (error, response) => {
      if (error) {
        return error.name === 'AbortError' || /Failed to fetch|NetworkError|load failed|timeout/i.test(error.message || '');
      }
      if (response) {
        const s = response.status;
        return (s >= 500 && s < 600) || s === 429 || s === 408;
      }
      return false;
    }
  };

  const retryConfig: RetryConfig = { ...DEFAULT_RETRY, ...(options.retryConfig || {}) } as RetryConfig;
  const { retries, retryDelay, jitter, retryCondition } = retryConfig;

  const fetchOptions: RequestInit = { ...options };
  delete (fetchOptions as any).retryConfig;

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      lastResponse = response;
      if (!response.ok && retryCondition(null, response) && attempt <= retries) {
        const delay = calculateRetryDelay(attempt, retryDelay, jitter);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      const error = err as Error;
      lastError = error;
      if (retryCondition(error, null) && attempt <= retries) {
        const delay = calculateRetryDelay(attempt, retryDelay, jitter);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
  if (lastResponse) return lastResponse;
  throw new Error('Unexpected retry loop exit');
}

export class SommOSAPI {
  baseURL: string;
  timeout: number;
  retryConfig: RetryConfig;

  constructor(options: Partial<RetryConfig & { timeout: number; baseURL: string }> = {}) {
    const viteBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE) || '';
    const envBase = (typeof window !== 'undefined' && (window as any).__SOMMOS_API_BASE__) || viteBase || (typeof process !== 'undefined' && (process as any).env?.SOMMOS_API_BASE_URL) || '';
    const normalized = (envBase || '').replace(/\/$/, '');

    if (normalized) {
      this.baseURL = normalized;
    } else if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname, port, origin } = window.location;
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      let resolvedOrigin = origin || `${protocol}//${hostname}${port ? `:${port}` : ''}`;
      if (isLocalhost && (!port || port === '')) {
        resolvedOrigin = `${protocol}//${hostname}:3000`;
      }
      this.baseURL = `${resolvedOrigin.replace(/\/$/, '')}/api`;
    } else {
      this.baseURL = 'http://localhost:3000/api';
    }

    this.timeout = options.timeout ?? 10000;
    this.retryConfig = {
      retries: options.retries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      jitter: options.jitter ?? true,
      retryCondition: (error, response) => {
        if (options.retryCondition) return options.retryCondition(error, response);
        if (error) return error.name === 'AbortError' || /Failed to fetch|NetworkError|load failed|timeout/i.test(error.message || '');
        if (response) {
          const s = response.status;
          return (s >= 500 && s < 600) || s === 429 || s === 408;
        }
        return false;
      }
    };
  }

  async request<T = any>(endpoint: string, options: RequestInit & { retryConfig?: Partial<RetryConfig> } = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetchWithRetry(url, { ...options, headers, credentials: (options as any).credentials || 'include', signal: controller.signal });
      clearTimeout(timeoutId);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const isText = contentType.includes('text/') || contentType.includes('application/yaml');

      let parsed: any;
      if (isJson) {
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }
      } else if (isText) {
        parsed = await res.text();
      }

      if (!res.ok) {
        if (parsed && typeof parsed === 'object' && (parsed as any).error) {
          const { code, message, details } = (parsed as any).error;
          throw new SommOSAPIError(message || `HTTP ${res.status}`, { status: res.status, code: code || 'HTTP_ERROR', details });
        }
        throw new SommOSAPIError(`HTTP ${res.status}: ${res.statusText}`, { status: res.status, code: 'HTTP_ERROR', details: parsed });
      }

      if (typeof parsed === 'undefined') return null as unknown as T;
      if (isJson && parsed && typeof parsed === 'object') {
        const normalized = {
          success: Object.prototype.hasOwnProperty.call(parsed, 'success') ? parsed.success : true,
          data: Object.prototype.hasOwnProperty.call(parsed, 'data') ? parsed.data : parsed,
          meta: (parsed as any).meta,
          message: (parsed as any).message,
          status: (parsed as any).status,
          raw: parsed
        } as any;

        if (typeof normalized.meta === 'undefined') delete normalized.meta;
        if (typeof normalized.message === 'undefined') delete normalized.message;
        if (typeof normalized.status === 'undefined') delete normalized.status;
        return normalized as T;
      }
      return parsed as T;
    } catch (e) {
      const error = e as Error;
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout / 1000} seconds. Please try again.`);
      }
      if (error.message && /Failed to fetch/i.test(error.message)) {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error instanceof SommOSAPIError ? error : new SommOSAPIError(error.message);
    }
  }

  healthCheck() {
    return this.request('/system/health');
  }
}

export const api = new SommOSAPI();


