export interface ApiMeta {
  requestId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  meta: ApiMeta;
  error: ApiErrorBody | null;
}

export function createSuccessResponse<T>(
  data: T,
  meta: ApiMeta = {},
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
    error: null,
  };
}

export function createErrorResponse(
  error: ApiErrorBody,
  meta: ApiMeta = {},
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
    error,
  };
}
