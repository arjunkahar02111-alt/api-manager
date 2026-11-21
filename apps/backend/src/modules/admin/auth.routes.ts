import { Router } from 'express';
import { AuthService } from '../../services/auth.service.js';
import { AdminLoginSchema } from '@arjun/schemas';
import { sendSuccess } from '@arjun/shared';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const validated = AdminLoginSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.adminLogin(validated.username, validated.password, clientIp, userAgent);
    return sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAdminAuth, (req, res) => {
  return sendSuccess(res, null, 'Logged out successfully');
});

router.get('/me', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  return sendSuccess(res, { admin: req.admin });
});

export default router;
