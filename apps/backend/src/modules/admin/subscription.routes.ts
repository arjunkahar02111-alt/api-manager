import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { SubscriptionService } from '../../services/subscription.service.js';
import { CreateSubscriptionPlanSchema } from '@arjun/schemas';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await SubscriptionService.listPlans();
    return sendSuccess(res, plans);
  } catch (err) {
    next(err);
  }
});

router.post('/plans', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = CreateSubscriptionPlanSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const plan = await SubscriptionService.createPlan(validated, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, plan, 'Subscription plan created', 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/plans/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await SubscriptionService.updatePlan(id, req.body, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, updated, 'Subscription plan updated');
  } catch (err) {
    next(err);
  }
});

export default router;
