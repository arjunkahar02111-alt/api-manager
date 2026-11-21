import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '@arjun/shared';
import { Administrator } from '../database/models/index.js';
import { SecurityService } from '../services/security.service.js';

export interface AuthenticatedAdminRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
    sessionId?: string;
  };
}

export async function requireAdminAuth(req: AuthenticatedAdminRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Admin authorization token required', 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token is missing', 'NO_TOKEN');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.adminSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired admin token', 'TOKEN_EXPIRED');
    }

    const admin = await Administrator.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      throw new ForbiddenError('Admin account inactive or not found', 'ADMIN_INACTIVE');
    }

    // Strict Single-User Concurrent Login Enforcement
    if (decoded.sessionId) {
      const isSessionValid = await SecurityService.validateSession(admin._id.toString(), 'admin', decoded.sessionId);
      if (!isSessionValid) {
        throw new UnauthorizedError(
          'Security Alert: Another login session was established on this administrator account. You have been automatically logged out for security.',
          'CONCURRENT_LOGIN_TERMINATED'
        );
      }
    }

    req.admin = {
      id: admin._id.toString(),
      username: admin.username,
      role: admin.role,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (err) {
    next(err);
  }
}
