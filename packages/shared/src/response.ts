import { AppError } from './errors.js';

export interface ResponseLike {
  status(code: number): this;
  json(body: unknown): this;
  setHeader?(name: string, value: string): this;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    timestamp: string;
    requestId?: string;
  };
}

export function sendSuccess<T>(
  res: ResponseLike,
  data?: T,
  message?: string,
  statusCode = 200,
  meta?: Partial<ApiResponse['meta']>
): ResponseLike {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
  return res.status(statusCode).json(payload);
}

export function sendError(res: ResponseLike, error: unknown, requestId?: string): ResponseLike {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }

  // Handle generic error without leaking internals
  const message = error instanceof Error ? error.message : 'Internal server error';
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
    },
  });
}
