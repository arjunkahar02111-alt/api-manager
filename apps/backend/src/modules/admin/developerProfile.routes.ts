import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { UpdateDeveloperProfileSchema } from '@arjun/schemas';
import { DeveloperProfileService } from '../../services/developerProfile.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();
router.use(requireAdminAuth);

/**
 * Admin: Get Developer Profile configuration
 */
router.get('/', async (_req, res, next) => {
  try {
    const profile = await DeveloperProfileService.getProfile();
    return sendSuccess(res, profile, 'Developer profile retrieved');
  } catch (err) {
    next(err);
  }
});

/**
 * Admin: Update Developer Profile configuration
 */
router.put('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = UpdateDeveloperProfileSchema.parse(req.body);
    const adminId = req.admin?.id || 'admin';
    const adminUsername = req.admin?.username || 'admin';
    const sourceIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const updated = await DeveloperProfileService.updateProfile(
      validated,
      adminId,
      adminUsername,
      sourceIp
    );

    return sendSuccess(res, updated, 'Developer profile updated successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
