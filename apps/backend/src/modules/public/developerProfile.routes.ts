import { Router } from 'express';
import { DeveloperProfileService } from '../../services/developerProfile.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

/**
 * Public endpoint to fetch active developer profile & credits
 */
router.get('/', async (_req, res, next) => {
  try {
    const profile = await DeveloperProfileService.getProfile();
    return sendSuccess(res, profile, 'Developer profile retrieved');
  } catch (err) {
    next(err);
  }
});

export default router;
