import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { MaintenanceService } from '../../services/maintenance.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const status = await MaintenanceService.getStatus();
    return sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await MaintenanceService.setMaintenance(
      req.body,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, updated, 'Maintenance settings updated');
  } catch (err) {
    next(err);
  }
});

export default router;
