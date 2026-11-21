import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { CustomerWebhook, WebhookDelivery } from '../../database/models/index.js';
import { CreateWebhookSchema } from '@arjun/schemas';
import { sendSuccess, encryptSecret, NotFoundError, ValidationError, isPrivateOrReservedIp } from '@arjun/shared';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const webhooks = await CustomerWebhook.find({ customerId: req.customer!.customerId }).sort({ createdAt: -1 });
    // Mask secrets
    const sanitized = webhooks.map((w) => ({
      id: w._id,
      url: w.url,
      events: w.events,
      enabled: w.enabled,
      createdAt: w.createdAt,
    }));
    return sendSuccess(res, sanitized);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const validated = CreateWebhookSchema.parse(req.body);

    // SSRF Guard: Validate destination host does not resolve to private/loopback IP
    const parsedUrl = new URL(validated.url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new ValidationError('Webhook URL must use HTTP or HTTPS protocol');
    }

    try {
      const addresses = await dns.lookup(parsedUrl.hostname, { all: true });
      for (const addr of addresses) {
        if (isPrivateOrReservedIp(addr.address)) {
          throw new ValidationError('Webhook destination cannot point to private, loopback, or cloud metadata IP addresses');
        }
      }
    } catch (dnsErr: any) {
      if (dnsErr instanceof ValidationError) throw dnsErr;
      throw new ValidationError(`Cannot resolve webhook hostname '${parsedUrl.hostname}'`);
    }

    // Generate random HMAC signing secret
    const signingSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const encryptedSecret = encryptSecret(signingSecret);

    const webhook = await CustomerWebhook.create({
      customerId: req.customer!.customerId,
      url: validated.url,
      encryptedSecret,
      events: validated.events,
      enabled: validated.enabled,
    });

    return sendSuccess(
      res,
      {
        id: webhook._id,
        url: webhook.url,
        events: webhook.events,
        signingSecret, // Revealed ONCE during creation!
      },
      'Webhook configured successfully',
      201
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const deleted = await CustomerWebhook.findOneAndDelete({
      _id: req.params.id,
      customerId: req.customer!.customerId,
    });
    if (!deleted) throw new NotFoundError('Webhook configuration not found');
    return sendSuccess(res, null, 'Webhook deleted');
  } catch (err) {
    next(err);
  }
});

router.get('/deliveries', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const deliveries = await WebhookDelivery.find({ customerId: req.customer!.customerId })
      .sort({ createdAt: -1 })
      .limit(50);
    return sendSuccess(res, deliveries);
  } catch (err) {
    next(err);
  }
});

export default router;
