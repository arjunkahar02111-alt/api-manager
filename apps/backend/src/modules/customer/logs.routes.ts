import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { RequestLog } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const statusCode = req.query.statusCode ? parseInt(req.query.statusCode as string, 10) : undefined;

    // Strict tenant isolation: customer can ONLY access their own logs
    const query: Record<string, unknown> = { customerId: req.customer!.customerId };
    if (statusCode) query.statusCode = statusCode;

    const total = await RequestLog.countDocuments(query);
    const logs = await RequestLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('apiId', 'name gatewayPath')
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

router.get('/export', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const logs = await RequestLog.find({ customerId: req.customer!.customerId })
      .sort({ timestamp: -1 })
      .limit(2000)
      .populate('apiId', 'name')
      .lean();

    const csvHeader = 'RequestID,API,Method,Endpoint,StatusCode,DurationMs,Bytes,Timestamp\n';
    const csvRows = logs
      .map((l: any) =>
        [
          l.requestId,
          l.apiId?.name || 'Unknown',
          l.method,
          `"${l.endpoint}"`,
          l.statusCode,
          l.durationMs,
          (l.requestBytes || 0) + (l.responseBytes || 0),
          new Date(l.timestamp).toISOString(),
        ].join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=my-api-logs-${Date.now()}.csv`);
    return res.status(200).send(csvHeader + csvRows);
  } catch (err) {
    next(err);
  }
});

export default router;
