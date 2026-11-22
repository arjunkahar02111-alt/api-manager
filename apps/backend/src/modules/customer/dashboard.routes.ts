import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { CustomerService } from '../../services/customer.service.js';
import { Customer, ApiCatalog, RequestLog, Announcement } from '../../database/models/index.js';
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

    // Active Announcements: Targeted Direct User Messages and Global Mass Broadcasts
    const activeAnnouncements = await Announcement.find({
      status: 'published',
      $or: [
        { targetScope: 'global' },
        { targetScope: 'client', targetClientId: { $in: [customerId, customer.username] } },
        { targetScope: 'client', targetCustomerUsername: customer.username },
        { targetScope: 'apiKey', targetApiKey: req.customer!.keyPrefix },
      ],
      $and: [
        { $or: [{ startDate: { $lte: new Date() } }, { startDate: null }, { startDate: { $exists: false } }] },
        { $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }, { expiresAt: { $exists: false } }] },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    const announcements = activeAnnouncements.map((ann) => {
      const isAcked = (ann.acknowledgments || []).some(
        (a: any) => a.clientId === customerId || a.customerUsername === customer.username
      );
      return {
        id: ann.announcementId,
        title: ann.title,
        message: ann.message,
        type: ann.type,
        severity: ann.severity,
        priority: ann.priority,
        targetScope: ann.targetScope,
        recommendedAction: ann.recommendedAction,
        actionUrl: ann.actionUrl,
        acknowledgmentRequired: ann.acknowledgmentRequired,
        acknowledged: isAcked,
        createdAt: ann.createdAt,
      };
    });

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
      announcements,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
