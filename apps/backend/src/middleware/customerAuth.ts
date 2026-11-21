import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '@arjun/shared';
import { Customer } from '../database/models/index.js';
import { SecurityService } from '../services/security.service.js';

export interface AuthenticatedCustomerRequest extends Request {
  customer?: {
    customerId: string;
    username: string;
    email: string;
    keyPrefix: string;
    sessionId?: string;
  };
}

export async function requireCustomerAuth(req: AuthenticatedCustomerRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Customer session token required', 'NO_SESSION_TOKEN');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Token is missing', 'NO_SESSION_TOKEN');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.customerSecret);
    } catch {
      throw new UnauthorizedError('Session expired. Please log in again using your API key.', 'SESSION_EXPIRED');
    }

    const customer = await Customer.findById(decoded.customerId);
    if (!customer) {
      throw new UnauthorizedError('Customer account not found', 'CUSTOMER_NOT_FOUND');
    }

    if (customer.status === 'suspended') {
      throw new ForbiddenError('Your account has been suspended by the administrator', 'ACCOUNT_SUSPENDED');
    }

    if (customer.status === 'expired' || customer.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenError('Your account has expired. Please contact support.', 'ACCOUNT_EXPIRED');
    }

    // Strict Single-User Concurrent Login Enforcement
    if (decoded.sessionId) {
      const isSessionValid = await SecurityService.validateSession(customer._id.toString(), 'customer', decoded.sessionId);
      if (!isSessionValid) {
        throw new UnauthorizedError(
          'Security Alert: Another login session was established on this account. You have been automatically logged out for security.',
          'CONCURRENT_LOGIN_TERMINATED'
        );
      }
    }

    req.customer = {
      customerId: customer._id.toString(),
      username: customer.username,
      email: customer.email,
      keyPrefix: decoded.keyPrefix,
      sessionId: decoded.sessionId,
    };

    next();
  } catch (err) {
    next(err);
  }
}
