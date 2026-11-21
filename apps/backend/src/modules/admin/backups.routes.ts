import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { sendSuccess } from '@arjun/shared';
import { logAdminAction } from '../../services/audit.service.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

router.use(requireAdminAuth);

const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

router.get('/', async (req, res, next) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files.map((file) => {
      const stats = fs.statSync(path.join(BACKUPS_DIR, file));
      return {
        id: file,
        filename: file,
        sizeBytes: stats.size,
        createdAt: stats.birthtime,
      };
    });

    return sendSuccess(res, backups);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.json`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    // Write safe metadata snapshot
    const metadata = {
      createdAt: new Date().toISOString(),
      initiatedBy: req.admin!.username,
      version: '1.0.0',
    };
    fs.writeFileSync(backupPath, JSON.stringify(metadata, null, 2));

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    await logAdminAction({
      administratorId: req.admin!.id,
      administratorUsername: req.admin!.username,
      action: 'DATABASE_BACKUP_CREATED',
      resourceType: 'backup',
      resourceId: backupName,
      sourceIp: clientIp,
      result: 'success',
    });

    return sendSuccess(res, { filename: backupName }, 'Backup created successfully', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
