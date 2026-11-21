import { Router } from 'express';
import multer from 'multer';
import { requireAdminAuth } from '../../middleware/adminAuth.js';
import { HostingService } from '../../services/hosting.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max ZIP size
});

router.use(requireAdminAuth);

/**
 * List all micro-app deployments
 */
router.get('/', async (_req, res, next) => {
  try {
    const list = await HostingService.listDeployments();
    return sendSuccess(res, list);
  } catch (err) {
    next(err);
  }
});

/**
 * Deploy a new micro-app from ZIP or configuration
 */
router.post('/deploy', upload.single('projectZip'), async (req, res, next) => {
  try {
    const { name, slug, description, runtime, port, gatewayPath, entryPoint } = req.body;
    let envVars: Record<string, string> = {};

    if (req.body.envVars) {
      try {
        envVars = typeof req.body.envVars === 'string' ? JSON.parse(req.body.envVars) : req.body.envVars;
      } catch {}
    }

    const deployment = await HostingService.createDeployment({
      name,
      slug: slug.toLowerCase(),
      description,
      runtime: runtime || 'nodejs',
      port: parseInt(port, 10),
      gatewayPath,
      envVars,
      entryPoint,
      zipBuffer: req.file?.buffer,
    });

    return sendSuccess(res, deployment, 'Micro-application deployed successfully', 201);
  } catch (err) {
    next(err);
  }
});

/**
 * Start deployment
 */
router.post('/:id/start', async (req, res, next) => {
  try {
    const deployment = await HostingService.startDeployment(req.params.id as string);
    return sendSuccess(res, deployment, 'Micro-app process started');
  } catch (err) {
    next(err);
  }
});

/**
 * Stop deployment
 */
router.post('/:id/stop', async (req, res, next) => {
  try {
    const deployment = await HostingService.stopDeployment(req.params.id as string);
    return sendSuccess(res, deployment, 'Micro-app process stopped');
  } catch (err) {
    next(err);
  }
});

/**
 * Restart deployment
 */
router.post('/:id/restart', async (req, res, next) => {
  try {
    const deployment = await HostingService.restartDeployment(req.params.id as string);
    return sendSuccess(res, deployment, 'Micro-app process restarted');
  } catch (err) {
    next(err);
  }
});

/**
 * Delete deployment
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await HostingService.deleteDeployment(req.params.id as string);
    return sendSuccess(res, null, 'Micro-app deployment removed');
  } catch (err) {
    next(err);
  }
});

/**
 * Get deployment stdout & stderr logs
 */
router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await HostingService.getLogs(req.params.id as string);
    return sendSuccess(res, logs);
  } catch (err) {
    next(err);
  }
});

export default router;
