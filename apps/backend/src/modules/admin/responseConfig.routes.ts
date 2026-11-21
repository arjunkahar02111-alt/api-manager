import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { ResponseConfigService } from '../../services/responseConfig.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();
router.use(requireAdminAuth);

/**
 * Get active response configuration
 */
router.get('/', async (req, res, next) => {
  try {
    const configKey = (req.query.key as string) || 'global';
    const config = await ResponseConfigService.getConfig(configKey);
    return sendSuccess(res, config);
  } catch (err) {
    next(err);
  }
});

/**
 * Update response configuration
 */
router.put('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const configKey = (req.body.configKey as string) || 'global';
    const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await ResponseConfigService.updateConfig(
      configKey,
      req.body,
      req.admin!.id,
      req.admin!.username,
      sourceIp
    );
    return sendSuccess(res, updated, 'Response envelope configuration updated successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
