import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { CustomerService } from '../../services/customer.service.js';
import { CreateCustomerSchema, UpdateCustomerSchema, ExtendCustomerValiditySchema, ResetBoundIpSchema } from '@arjun/schemas';
import { Customer, ApiKey } from '../../database/models/index.js';
import { getRedisClient } from '../../services/redis.service.js';
import { SocketService } from '../../services/socket.service.js';
import { SecurityService } from '../../services/security.service.js';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const query: Record<string, unknown> = { status: { $ne: 'deleted' } };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const customerIds = customers.map((c) => c._id);
    const keys = await ApiKey.find({ customerId: { $in: customerIds }, status: 'active' }).lean();
    const keyMap = new Map(keys.map((k) => [k.customerId.toString(), k.keyPrefix]));

    const enriched = customers.map((c) => ({
      ...c,
      keyPrefix: keyMap.get(c._id.toString()) || null,
    }));

    return sendSuccess(res, enriched, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = CreateCustomerSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const result = await CustomerService.createCustomer(
      validated as any,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );

    return sendSuccess(res, result, 'Customer account created successfully', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/export', async (_req, res, next) => {
  try {
    const csv = await CustomerService.exportCustomersCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers-export.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-suspend', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { customerIds } = req.body || {};
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'customerIds array required' });
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.bulkSuspend(customerIds, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, `Suspended ${result.affected} customer accounts`);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-activate', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { customerIds } = req.body || {};
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'customerIds array required' });
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.bulkActivate(customerIds, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, `Activated ${result.affected} customer accounts`);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk-renew', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { customerIds, additionalDays } = req.body || {};
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'customerIds array required' });
    }
    const days = Number(additionalDays) || 30;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.bulkRenew(customerIds, days, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, `Renewed ${result.affected} customer accounts for +${days} days`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const customer = await Customer.findById(id).lean();
    if (!customer || customer.status === 'deleted') {
      throw new NotFoundError('Customer not found');
    }

    const apiKey = await ApiKey.findOne({ customerId: customer._id, status: 'active' }).lean();
    const usage = await CustomerService.getCustomerUsage(id);

    return sendSuccess(res, {
      ...customer,
      keyPrefix: apiKey?.keyPrefix || null,
      usage,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const validated = UpdateCustomerSchema.parse(req.body);
    const customer = await Customer.findById(id);
    if (!customer) throw new NotFoundError('Customer not found');

    Object.assign(customer, validated);
    await customer.save();

    // Invalidate cached key in Redis so changes apply immediately
    const key = await ApiKey.findOne({ customerId: customer._id, status: 'active' });
    if (key) {
      const redis = getRedisClient();
      await redis.del(`auth:key:${key.keyHash}`);
      await redis.del(`key:bound_ip:${key.keyHash}`);
    }

    SocketService.broadcastToAdmin('client:updated', {
      customerId: customer._id.toString(),
      action: 'updated',
    });

    return sendSuccess(res, customer, 'Customer updated successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reset-bound-ip', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { newIp } = ResetBoundIpSchema.parse(req.body);
    const customer = await SecurityService.resetCustomerBoundIp(id, newIp);
    return sendSuccess(
      res,
      customer,
      newIp ? `Bound IP locked to ${newIp}` : 'IP lock reset. The next request will automatically bind.'
    );
  } catch (err) {
    next(err);
  }
});

router.post('/:id/suspend', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.suspendCustomer(id, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, 'Customer suspended successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/activate', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.activateCustomer(id, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, 'Customer activated successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/renew', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const { additionalDays } = ExtendCustomerValiditySchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.renewCustomer(id, additionalDays, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, 'Customer renewed successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/regenerate-key', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.regenerateApiKey(id, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result, 'API key regenerated successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reset-usage', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const type = (req.body.type || 'daily') as 'daily' | 'monthly' | 'lifetime';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await CustomerService.resetUsage(id, type, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = req.params.id as string;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await CustomerService.deleteCustomer(id, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, null, 'Customer deleted successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
