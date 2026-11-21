import { Router } from 'express';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { RequestLog } from '../../database/models/index.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const customerId = req.query.customerId as string;
    const apiId = req.query.apiId as string;
    const statusCode = req.query.statusCode ? parseInt(req.query.statusCode as string, 10) : undefined;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: Record<string, unknown> = {};
    if (customerId) query.customerId = customerId;
    if (apiId) query.apiId = apiId;
    if (statusCode) query.statusCode = statusCode;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) (query.timestamp as any).$gte = new Date(startDate);
      if (endDate) (query.timestamp as any).$lte = new Date(endDate);
    }

    const total = await RequestLog.countDocuments(query);
    const logs = await RequestLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'username fullName')
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

router.get('/export', async (req, res, next) => {
  try {
    const logs = await RequestLog.find()
      .sort({ timestamp: -1 })
      .limit(5000)
      .populate('customerId', 'username')
      .populate('apiId', 'name')
      .lean();

    const csvHeader = 'RequestID,Customer,API,Method,Endpoint,StatusCode,DurationMs,Bytes,Timestamp,SourceIp\n';
    const csvRows = logs
      .map((l: any) =>
        [
          l.requestId,
          l.customerId?.username || 'Unknown',
          l.apiId?.name || 'Unknown',
          l.method,
          `"${l.endpoint}"`,
          l.statusCode,
          l.durationMs,
          (l.requestBytes || 0) + (l.responseBytes || 0),
          new Date(l.timestamp).toISOString(),
          l.sourceIp,
        ].join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=request-logs-${Date.now()}.csv`);
    return res.status(200).send(csvHeader + csvRows);
  } catch (err) {
    next(err);
  }
});

export default router;
