import type { Request, Response, NextFunction } from 'express';
import { AppError, sendError, redactSensitiveData, ValidationError } from '@arjun/shared';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  // Transform Zod validation errors into HTTP 400 ValidationError
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    const valError = new ValidationError(message, err.format());
    return sendError(res, valError, requestId);
  }

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
