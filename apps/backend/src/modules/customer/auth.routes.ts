import { Router } from 'express';
import { AuthService } from '../../services/auth.service.js';
import { DeviceService } from '../../services/device.service.js';
import { CustomerLoginSchema, CustomerPasswordLoginSchema, CustomerRegisterSchema } from '@arjun/schemas';
import { sendSuccess } from '@arjun/shared';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { Customer, ApiKey } from '../../database/models/index.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const validated = CustomerRegisterSchema.parse(req.body);
    const result = await AuthService.customerRegister(validated);
    const sourceIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await DeviceService.recordDeviceLogin({
      userId: result.customer.id,
      ipAddress: sourceIp,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { apiKey } = CustomerLoginSchema.parse(req.body);
    const result = await AuthService.customerKeyLogin(apiKey);
    const sourceIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await DeviceService.recordDeviceLogin({
      userId: result.customer.id,
      ipAddress: sourceIp,
      userAgent: req.headers['user-agent'],
    });
    return sendSuccess(res, result, 'Customer authentication successful');
  } catch (err) {
    next(err);
  }
});

router.post('/login-password', async (req, res, next) => {
  try {
    const validated = CustomerPasswordLoginSchema.parse(req.body);
    const sourceIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const result = await AuthService.customerPasswordLogin(
      validated.identifier,
      validated.password,
      sourceIp,
      req.headers['user-agent'],
      validated.totpCode
    );

    if ((result as any).requires2FA) {
      return res.status(200).json({ success: true, requires2FA: true, message: '2FA code required' });
    }

    await DeviceService.recordDeviceLogin({
      userId: (result as any).customer.id,
      ipAddress: sourceIp,
      userAgent: req.headers['user-agent'],
    });

    return sendSuccess(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireCustomerAuth, (req, res) => {
  return sendSuccess(res, null, 'Customer logged out successfully');
});

router.get('/me', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const customer = await Customer.findById(req.customer!.customerId).lean();
    const apiKey = await ApiKey.findOne({ customerId: req.customer!.customerId, status: 'active' }).lean();

    return sendSuccess(res, {
      ...customer,
      keyPrefix: apiKey?.keyPrefix || req.customer!.keyPrefix,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
