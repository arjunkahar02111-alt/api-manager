import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { SystemService } from '../../services/system.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/metrics', async (req, res, next) => {
  try {
    const metrics = await SystemService.getSystemMetrics();
    return sendSuccess(res, metrics);
  } catch (err) {
    next(err);
  }
});

export default router;
