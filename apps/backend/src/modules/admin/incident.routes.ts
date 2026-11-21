import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { IncidentService } from '../../services/incident.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();
router.use(requireAdminAuth);

/**
 * List incidents
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, severity, page, limit } = req.query;
    const result = await IncidentService.listIncidents({
      status: status as string,
      severity: severity as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });
    return sendSuccess(res, result.incidents, undefined, 200, result.pagination);
  } catch (err) {
    next(err);
  }
});

/**
 * Get incident by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const incidentId = req.params.id as string;
    const incident = await IncidentService.getIncident(incidentId);
    return sendSuccess(res, incident);
  } catch (err) {
    next(err);
  }
});

/**
 * Create incident
 */
router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';
    const incident = await IncidentService.createIncident(
      req.body,
      req.admin!.id,
      req.admin!.username,
      sourceIp
    );
    return sendSuccess(res, incident, 'Incident created successfully', 201);
  } catch (err) {
    next(err);
  }
});

/**
 * Update incident & append timeline entry
 */
router.patch('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const incidentId = req.params.id as string;
    const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';
    const incident = await IncidentService.updateIncident(
      incidentId,
      req.body,
      req.admin!.id,
      req.admin!.username,
      sourceIp
    );
    return sendSuccess(res, incident, 'Incident updated successfully');
  } catch (err) {
    next(err);
  }
});

/**
 * Resolve incident
 */
router.post('/:id/resolve', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const incidentId = req.params.id as string;
    const { resolutionNotes, restoreServices } = req.body || {};
    const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';
    const incident = await IncidentService.resolveIncident(
      incidentId,
      resolutionNotes || 'Incident resolved by administrator.',
      restoreServices !== false,
      req.admin!.id,
      req.admin!.username,
      sourceIp
    );
    return sendSuccess(res, incident, 'Incident resolved successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
