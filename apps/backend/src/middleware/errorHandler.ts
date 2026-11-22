import type { Request, Response, NextFunction } from 'express';
import { AppError, sendError, redactSensitiveData, ValidationError, ConflictError } from '@arjun/shared';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || undefined;

  // Transform Zod validation errors into HTTP 400 ValidationError
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    const valError = new ValidationError(message, err.format());
    return sendError(res, valError, requestId);
  }

  // Transform MongoDB E11000 duplicate key error into HTTP 409 ConflictError
  if ((err as any)?.code === 11000) {
    const keyPattern = (err as any)?.keyPattern || (err as any)?.keyValue || {};
    const field = Object.keys(keyPattern)[0] || 'record';
    const conflictError = new ConflictError(`A ${field} with this identifier already exists.`);
    return sendError(res, conflictError, requestId);
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
