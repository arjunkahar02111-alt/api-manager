import type { Request, Response, NextFunction } from 'express';
import { AppError, sendError, redactSensitiveData } from '@arjun/shared';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  // Redact and safely log error
  if (err instanceof AppError && err.isOperational) {
    if (err.statusCode >= 500) {
      console.error(`[Error] ${req.method} ${req.path} -> ${err.statusCode} ${err.message}`, redactSensitiveData(err.details));
    }
  } else {
    console.error(`[UnhandledError] ${req.method} ${req.path}`, err);
  }

  return sendError(res, err, requestId);
}
