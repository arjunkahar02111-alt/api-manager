import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { Customer, ApiKey } from '../../database/models/index.js';
import { AnnouncementService } from '../../services/announcement.service.js';
import { UnauthorizedError, sendSuccess } from '@arjun/shared';

const router = Router();

router.post('/:id/acknowledge', async (req: Request, res: Response, next) => {
  try {
    const rawKey =
      (req.headers['x-api-key'] as string) ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : (req.query.key as string));

    if (!rawKey) {
      throw new UnauthorizedError(
        'API Key required to acknowledge announcement. Provide via header X-API-Key or Authorization: Bearer <key>',
        'MISSING_API_KEY'
      );
    }

    // Hash key and find matching active client
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKeyDoc = await ApiKey.findOne({ keyHash, status: 'active' });

    let customerId: string;
    let customerUsername: string = 'client';
    let keyPrefix: string = rawKey.slice(0, 10);

    if (apiKeyDoc) {
      customerId = apiKeyDoc.customerId;
      const customer = await Customer.findById(customerId);
      if (customer) {
        customerUsername = customer.username;
      }
      keyPrefix = apiKeyDoc.keyPrefix;
    } else {
      // Direct customer key lookup
      const customer = await Customer.findOne({
        $or: [{ apiKey: rawKey }, { apiKeyHash: keyHash }],
      });
      if (!customer) {
        throw new UnauthorizedError('Invalid API Key provided', 'INVALID_API_KEY');
      }
      customerId = customer._id.toString();
      customerUsername = customer.username;
      keyPrefix = (customer as any).keyPrefix || rawKey.slice(0, 10);
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const id = String(req.params.id);

    const result = await AnnouncementService.recordAcknowledgment(id, {
      clientId: customerId,
      customerUsername,
      keyPrefix,
      clientIp,
    });

    return sendSuccess(res, result, `Announcement ${id} acknowledged successfully.`);
  } catch (err) {
    next(err);
  }
});

export default router;
