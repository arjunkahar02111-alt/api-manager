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
    let token: string | undefined;

    // 1. Check HttpOnly Cookie (Primary Web Session)
    if (req.cookies?.arjun_admin_token) {
      token = req.cookies.arjun_admin_token;
    } else if (req.signedCookies?.arjun_admin_token) {
      token = req.signedCookies.arjun_admin_token;
    }

    // 2. Fallback to Authorization Header (Bearer token for API / automated testing clients)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError('Admin authorization token or session cookie required', 'NO_TOKEN');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.adminSecret);
    } catch {
      throw new UnauthorizedError('Invalid or expired admin session token', 'TOKEN_EXPIRED');
    }

    const admin = await Administrator.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      throw new ForbiddenError('Admin account inactive or not found', 'ADMIN_INACTIVE');
    }

    // Immediate token invalidation if password was changed after token issuance
    if (admin.passwordChangedAt && decoded.iat) {
      const tokenIssuedAtMs = decoded.iat * 1000;
      if (tokenIssuedAtMs < admin.passwordChangedAt.getTime() - 1000) {
        throw new UnauthorizedError('Password was updated. Please authenticate again.', 'PASSWORD_CHANGED');
      }
    }

    // Validate server-side session in Redis / MongoDB (enforces idle timeout & revocation)
    if (decoded.sessionId) {
      const isSessionValid = await SecurityService.validateSession(admin._id.toString(), 'admin', decoded.sessionId);
      if (!isSessionValid) {
        throw new UnauthorizedError(
          'Security Notice: Administrator session has expired, was revoked, or terminated.',
          'SESSION_TERMINATED'
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
