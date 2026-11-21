import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { CustomerIpAllowlist, Customer } from '../../database/models/index.js';
import { CreateIpAllowlistSchema } from '@arjun/schemas';
import { sendSuccess, ValidationError, NotFoundError } from '@arjun/shared';
import { isValidCidr } from '@arjun/shared';
import { getRedisClient } from '../../services/redis.service.js';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const ips = await CustomerIpAllowlist.find({ customerId: req.customer!.customerId }).sort({ createdAt: -1 });
    return sendSuccess(res, ips);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { cidr, label } = CreateIpAllowlistSchema.parse(req.body);
    if (!isValidCidr(cidr)) {
      throw new ValidationError('Invalid IP or CIDR block format. Example: 192.168.1.100 or 10.0.0.0/24');
    }

    const created = await CustomerIpAllowlist.create({
      customerId: req.customer!.customerId,
      cidr: cidr.trim(),
      label: label || '',
      enabled: true,
    });

    // Update customer allowedIps array and evict Redis cache
    await Customer.findByIdAndUpdate(req.customer!.customerId, {
      $addToSet: { allowedIps: cidr.trim() },
    });

    const redis = getRedisClient();
    await redis.del(`customer:${req.customer!.customerId}`);

    return sendSuccess(res, created, 'IP address added to allowlist', 201);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const entry = await CustomerIpAllowlist.findOneAndDelete({
      _id: req.params.id,
      customerId: req.customer!.customerId,
    });

    if (!entry) throw new NotFoundError('IP allowlist entry not found');

    // Remove from customer document
    await Customer.findByIdAndUpdate(req.customer!.customerId, {
      $pull: { allowedIps: entry.cidr },
    });

    const redis = getRedisClient();
    await redis.del(`customer:${req.customer!.customerId}`);

    return sendSuccess(res, null, 'IP address removed from allowlist');
  } catch (err) {
    next(err);
  }
});

export default router;
