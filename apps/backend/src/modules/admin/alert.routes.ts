import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { AlertService } from '../../services/alert.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();
router.use(requireAdminAuth);

/**
 * List intelligent alerts
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, severity, type, page, limit } = req.query;
    const result = await AlertService.listAlerts({
      status: status as string,
      severity: severity as string,
      type: type as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    });
    return sendSuccess(res, result.alerts, undefined, 200, result.pagination);
  } catch (err) {
    next(err);
  }
});

/**
 * Get active alerts summary
 */
router.get('/summary', async (_req, res, next) => {
  try {
    const summary = await AlertService.getSummary();
    return sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
});

/**
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const alertId = req.params.id as string;
    const alert = await AlertService.acknowledgeAlert(alertId, req.admin!.username);
    return sendSuccess(res, alert, 'Alert acknowledged successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * Resolve an alert
 */
router.post('/:id/resolve', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const alertId = req.params.id as string;
    const { resolutionNotes } = req.body || {};
    const alert = await AlertService.resolveAlert(alertId, req.admin!.username, resolutionNotes);
    return sendSuccess(res, alert, 'Alert resolved successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
