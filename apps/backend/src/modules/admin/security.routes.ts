import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { SecurityIncident, IpBlacklist, Customer } from '../../database/models/index.js';
import { SecurityService } from '../../services/security.service.js';
import { BlacklistIpSchema, SecurityIncidentFilterSchema, ResetBoundIpSchema } from '@arjun/schemas';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

/**
 * List Security Incidents (Key sharing violations, brute force, etc.)
 */
router.get('/incidents', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const severity = req.query.severity as string;
    const incidentType = req.query.incidentType as string;

    const query: Record<string, unknown> = {};
    if (severity) query.severity = severity;
    if (incidentType) query.incidentType = incidentType;

    const total = await SecurityIncident.countDocuments(query);
    const incidents = await SecurityIncident.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customerId', 'username fullName')
      .lean();

    return sendSuccess(res, incidents, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * List Blacklisted IPs
 */
router.get('/blacklist', async (req, res, next) => {
  try {
    const blacklist = await IpBlacklist.find({ isActive: true }).sort({ updatedAt: -1 }).lean();
    return sendSuccess(res, blacklist);
  } catch (err) {
    next(err);
  }
});

/**
 * Manually Ban an IP
 */
router.post('/blacklist', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = BlacklistIpSchema.parse(req.body);
    const record = await SecurityService.blacklistIp(
      validated.ip,
      validated.reason,
      req.admin!.username,
      validated.expiresInHours
    );
    return sendSuccess(res, record, `IP ${validated.ip} has been added to the blacklist`, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * Unban / Remove IP from Blacklist
 */
router.delete('/blacklist/:ip', async (req, res, next) => {
  try {
    const ip = req.params.ip as string;
    await SecurityService.unblacklistIp(ip);
    return sendSuccess(res, null, `IP ${ip} has been unbanned successfully`);
  } catch (err) {
    next(err);
  }
});

/**
 * Reset Customer Bound IP (1-click unlock or re-bind)
 */
router.post('/customers/:id/reset-bound-ip', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { newIp } = ResetBoundIpSchema.parse(req.body);
    const customer = await SecurityService.resetCustomerBoundIp(id, newIp);
    return sendSuccess(
      res,
      customer,
      newIp
        ? `Customer ${customer.username} is now bound strictly to IP ${newIp}`
        : `Customer ${customer.username} IP lock has been reset. The next incoming request will auto-bind to the customer's IP.`
    );
  } catch (err) {
    next(err);
  }
});

/**
 * Security Stats & Metrics Summary
 */
router.get('/stats', async (_req, res, next) => {
  try {
    const [bannedIpsCount, totalIncidents, criticalIncidents, lockedCustomers] = await Promise.all([
      IpBlacklist.countDocuments({ isActive: true }),
      SecurityIncident.countDocuments(),
      SecurityIncident.countDocuments({ severity: 'CRITICAL' }),
      Customer.countDocuments({ boundIp: { $exists: true, $ne: null } }),
    ]);

    const recentIncidents = await SecurityIncident.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return sendSuccess(res, {
      bannedIpsCount,
      totalIncidents,
      criticalIncidents,
      lockedCustomers,
      recentIncidents,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
