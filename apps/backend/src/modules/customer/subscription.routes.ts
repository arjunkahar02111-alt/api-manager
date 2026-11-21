import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { Customer, SubscriptionPlan, ManualPayment } from '../../database/models/index.js';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId).lean();
    if (!customer) throw new NotFoundError('Customer not found');

    let plan = null;
    if (customer.planId) {
      plan = await SubscriptionPlan.findById(customer.planId).lean();
    }

    const paymentHistory = await ManualPayment.find({ customerId: req.customer!.customerId })
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, {
      status: customer.status,
      expiresAt: customer.expiresAt,
      plan: plan || {
        name: 'Custom Assigned Plan',
        dailyLimit: customer.dailyRequestLimit,
        monthlyLimit: customer.monthlyRequestLimit,
        lifetimeLimit: customer.lifetimeRequestLimit,
        bandwidthLimitBytes: customer.maxBandwidthBytes,
        concurrencyLimit: customer.maxConcurrentRequests,
      },
      payments: paymentHistory,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
