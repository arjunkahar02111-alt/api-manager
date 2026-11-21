import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { AdminAuditLog } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const action = req.query.action as string;
    const resourceType = req.query.resourceType as string;

    const query: Record<string, unknown> = {};
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;

    const total = await AdminAuditLog.countDocuments(query);
    const logs = await AdminAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return sendSuccess(res, logs, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
