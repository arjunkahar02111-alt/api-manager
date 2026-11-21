import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { SubscriptionService } from '../../services/subscription.service.js';
import { RecordManualPaymentSchema, VerifyPaymentSchema } from '@arjun/schemas';
import { ManualPayment } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const payments = await ManualPayment.find()
      .populate('customerId', 'username fullName email')
      .sort({ createdAt: -1 });
    return sendSuccess(res, payments);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = RecordManualPaymentSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const payment = await SubscriptionService.recordManualPayment(
      validated,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, payment, 'Manual payment recorded', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/verify', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { status, notes, extendCustomerDays } = VerifyPaymentSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const payment = await SubscriptionService.verifyManualPayment(
      id,
      status,
      notes,
      extendCustomerDays,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, payment, `Payment marked as ${status}`);
  } catch (err) {
    next(err);
  }
});

export default router;
