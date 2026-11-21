import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { AnnouncementService } from '../../services/announcement.service.js';
import { sendSuccess } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const list = await AnnouncementService.listAnnouncements({
      status: req.query.status as string,
      type: req.query.type as string,
      search: req.query.search as string,
      targetScope: req.query.targetScope as string,
    });
    return sendSuccess(res, list);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const created = await AnnouncementService.createAnnouncement(
      req.body,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, created, 'Announcement created successfully', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/emergency', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { title, message } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message required for emergency broadcast' });
    }
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await AnnouncementService.broadcastEmergency(
      title,
      message,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, result, 'Emergency broadcast published immediately to all active routes', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const item = await AnnouncementService.getAnnouncement(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 'ANNOUNCEMENT_NOT_FOUND', message: 'Announcement not found' },
      });
    }
    return sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const updated = await AnnouncementService.updateAnnouncement(
      id,
      req.body,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, updated, 'Announcement updated');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/publish', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const published = await AnnouncementService.publishAnnouncement(
      id,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, published, 'Announcement published successfully');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pause', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const paused = await AnnouncementService.pauseAnnouncement(
      id,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, paused, 'Announcement paused');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const deleted = await AnnouncementService.deleteAnnouncement(
      id,
      req.admin!.id,
      req.admin!.username,
      clientIp
    );
    return sendSuccess(res, deleted, 'Announcement deleted');
  } catch (err) {
    next(err);
  }
});

export default router;
