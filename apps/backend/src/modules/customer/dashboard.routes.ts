import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { CustomerService } from '../../services/customer.service.js';
import { Customer, ApiCatalog, RequestLog } from '../../database/models/index.js';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customerId = req.customer!.customerId;
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw new NotFoundError('Customer not found');

    const usage = await CustomerService.getCustomerUsage(customerId);

    // Number of accessible APIs
    let apiCount = 0;
    if (customer.allowedApis.includes('*')) {
      apiCount = await ApiCatalog.countDocuments({ status: 'active' });
    } else {
      apiCount = customer.allowedApis.length;
    }

    // Last request
    const lastLog = await RequestLog.findOne({ customerId }).sort({ timestamp: -1 }).lean();

    return sendSuccess(res, {
      profile: {
        id: customer._id,
        username: customer.username,
        fullName: customer.fullName,
        email: customer.email,
        company: customer.company,
        status: customer.status,
        expiresAt: customer.expiresAt,
        keyPrefix: req.customer!.keyPrefix,
      },
      usage,
      assignedApisCount: apiCount,
      lastRequestAt: lastLog?.timestamp || null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
