import { Router } from 'express';
import { AuthService } from '../../services/auth.service.js';
import { SecurityService } from '../../services/security.service.js';
import {
  AdminLoginSchema,
  AdminChangePasswordSchema,
  AdminVerifyMfaSchema,
  AdminDisableMfaSchema,
} from '@arjun/schemas';
import { sendSuccess } from '@arjun/shared';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

const router = Router();

/**
 * Helper to configure secure cookie attributes
 */
function setAdminSessionCookie(res: any, token: string, req: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('arjun_admin_token', token, {
    httpOnly: true,
    secure: isProduction || isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 3600 * 1000, // 24 hours
  });
}

function clearAdminSessionCookie(res: any, req: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.clearCookie('arjun_admin_token', {
    httpOnly: true,
    secure: isProduction || isHttps,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * POST /api/v1/admin/auth/login
 * Strict Administrator Clearance Authentication
 */
router.post('/login', async (req, res, next) => {
  try {
    const validated = AdminLoginSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] as string | undefined;

    const result = await AuthService.adminLogin(
      validated.username,
      validated.password,
      clientIp,
      userAgent,
      validated.totpCode
    );

    // Set secure HttpOnly cookie
    setAdminSessionCookie(res, result.accessToken, req);

    return sendSuccess(res, result, 'Login clearance granted');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/auth/logout
 * Server-side session termination & cookie purge
 */
router.post('/logout', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    if (req.admin?.sessionId) {
      await SecurityService.revokeSession(req.admin.sessionId, req.admin.id, 'admin');
    }
    clearAdminSessionCookie(res, req);
    return sendSuccess(res, null, 'Session revoked and logged out successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/auth/logout-all
 * Revokes all sessions across all devices for this administrator
 */
router.post('/logout-all', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    await SecurityService.revokeAllSessions(req.admin!.id, 'admin');
    clearAdminSessionCookie(res, req);
    return sendSuccess(res, null, 'All administrator sessions revoked successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/auth/sessions
 * List all active sessions across devices
 */
router.get('/sessions', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const sessions = await SecurityService.listActiveSessions(
      req.admin!.id,
      'admin',
      req.admin!.sessionId
    );
    return sendSuccess(res, sessions, 'Active administrator sessions retrieved');
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/admin/auth/sessions/:sessionId
 * Revokes an individual session
 */
router.delete('/sessions/:sessionId', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const sessionId = String(req.params.sessionId);
    await SecurityService.revokeSession(sessionId, req.admin!.id, 'admin');
    return sendSuccess(res, null, 'Target session revoked successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/auth/change-password
 * Changes passphrase, validates strength, and revokes all active sessions
 */
router.post('/change-password', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = AdminChangePasswordSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] as string | undefined;

    const result = await AuthService.changeAdminPassword(
      req.admin!.id,
      validated.currentPassword,
      validated.newPassword,
      clientIp,
      userAgent
    );

    clearAdminSessionCookie(res, req);
    return sendSuccess(res, result, 'Passphrase updated successfully. Please re-authenticate.');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/auth/mfa/setup
 * Generates TOTP setup secret and QR code URI
 */
router.get('/mfa/setup', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const setupData = await AuthService.setupAdminMfa(req.admin!.id);
    return sendSuccess(res, setupData, 'MFA setup secret generated');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/auth/mfa/enable
 * Verifies code and enables MFA
 */
router.post('/mfa/enable', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = AdminVerifyMfaSchema.parse(req.body);
    const secret = req.body.secret;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] as string | undefined;

    if (!secret) {
      return res.status(400).json({ success: false, message: 'Setup secret is required' });
    }

    const result = await AuthService.enableAdminMfa(
      req.admin!.id,
      secret,
      validated.code,
      clientIp,
      userAgent
    );

    return sendSuccess(res, result, 'Multi-Factor Authentication enabled');
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/auth/mfa/disable
 * Disables MFA after current passphrase & code verification
 */
router.post('/mfa/disable', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = AdminDisableMfaSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] as string | undefined;

    const result = await AuthService.disableAdminMfa(
      req.admin!.id,
      validated.password,
      validated.code,
      clientIp,
      userAgent
    );

    return sendSuccess(res, result, 'Multi-Factor Authentication disabled');
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/auth/me
 * Returns currently authenticated operator identity & session status
 */
router.get('/me', requireAdminAuth, async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const admin = await AuthService.getAdminById?.(req.admin!.id) || {
      id: req.admin!.id,
      username: req.admin!.username,
      role: req.admin!.role,
      sessionId: req.admin!.sessionId,
    };
    return sendSuccess(res, { admin });
  } catch (err) {
    next(err);
  }
});

export default router;
