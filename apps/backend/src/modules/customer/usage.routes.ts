import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { CustomerService } from '../../services/customer.service.js';
import { UsageDaily } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customerId = req.customer!.customerId;
    const usage = await CustomerService.getCustomerUsage(customerId);

    // Fetch daily history for last 14 days
    const dates: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().substring(0, 10));
    }

    const records = await UsageDaily.aggregate([
      { $match: { customerId: req.customer!.customerId, date: { $in: dates } } },
      {
        $group: {
          _id: '$date',
          requests: { $sum: '$requests' },
          successful: { $sum: '$successfulRequests' },
          failed: { $sum: '$failedRequests' },
          bandwidth: { $sum: '$bandwidthBytes' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const recordMap = new Map(records.map((r) => [r._id, r]));
    const history = dates.map((date) => {
      const r = recordMap.get(date);
      return {
        date,
        requests: r?.requests || 0,
        successful: r?.successful || 0,
        failed: r?.failed || 0,
        bandwidthBytes: r?.bandwidth || 0,
      };
    });

    return sendSuccess(res, {
      ...usage,
      history,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
