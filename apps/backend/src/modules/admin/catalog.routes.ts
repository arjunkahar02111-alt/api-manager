import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { CatalogService } from '../../services/catalog.service.js';
import { CreateApiCatalogSchema } from '@arjun/schemas';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const apis = await CatalogService.listApis({
      category: req.query.category as string,
      status: req.query.status as string,
      search: req.query.search as string,
    });
    return sendSuccess(res, apis);
  } catch (err) {
    next(err);
  }
});

router.post('/auto-connect', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const targetUrl = (req.body.targetUrl || req.body.url || '').trim();
    const name = req.body.name;
    const category = req.body.category;
    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'Target API URL is required' } });
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const api = await CatalogService.autoConnectApi(
      targetUrl,
      name,
      category,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, api, 'API auto-connected and deployed to gateway successfully', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const validated = CreateApiCatalogSchema.parse(req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const api = await CatalogService.createApi(validated, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, api, 'API catalog endpoint created', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const api = await CatalogService.getApiById(req.params.id as string);
    return sendSuccess(res, api);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await CatalogService.updateApi(req.params.id as string, req.body, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, updated, 'API endpoint updated');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await CatalogService.deleteApi(req.params.id as string, req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, null, 'API endpoint deleted');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const testResult = await CatalogService.testConnectivity(req.params.id as string);
    return sendSuccess(res, testResult, 'Upstream connectivity tested');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/enable', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await CatalogService.toggleStatus(req.params.id as string, 'active', req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, updated, 'API endpoint enabled');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/disable', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await CatalogService.toggleStatus(req.params.id as string, 'disabled', req.admin!.id, req.admin!.username, clientIp);
    return sendSuccess(res, updated, 'API endpoint disabled');
  } catch (err) {
    next(err);
  }
});

export default router;
