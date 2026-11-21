import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    // Structured log without leaking body/auth
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms | IP: ${clientIp} | ReqID: ${requestId}`
    );
  });

  next();
}
