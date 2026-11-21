import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { AnalyticsService } from '../../services/analytics.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const overview = await AnalyticsService.getAdminOverview();
    return sendSuccess(res, overview);
  } catch (err) {
    next(err);
  }
});

router.get('/trends', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 14;
    const trends = await AnalyticsService.getDailyTrends(days);
    return sendSuccess(res, trends);
  } catch (err) {
    next(err);
  }
});

export default router;
