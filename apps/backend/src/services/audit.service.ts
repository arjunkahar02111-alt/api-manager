import crypto from 'node:crypto';
import { AdminAuditLog } from '../database/models/index.js';

interface AuditLogParams {
  administratorId: string;
  administratorUsername: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  sourceIp: string;
  userAgent?: string;
  result?: 'success' | 'failure';
  errorMessage?: string;
  correlationId?: string;
}

export async function logAdminAction(params: AuditLogParams): Promise<void> {
  try {
    const correlationId = params.correlationId || crypto.randomUUID();
    const lastLog = await AdminAuditLog.findOne().sort({ createdAt: -1 }).select('integrityHash').lean();
    const previousHash = (lastLog as any)?.integrityHash || '0000000000000000000000000000000000000000000000000000000000000000';

    const timestamp = new Date();
    const rawPayload = `${previousHash}:${params.administratorId}:${params.action}:${params.resourceType}:${params.resourceId}:${timestamp.getTime()}`;
    const integrityHash = crypto.createHash('sha256').update(rawPayload).digest('hex');

    await AdminAuditLog.create({
      administratorId: params.administratorId,
      administratorUsername: params.administratorUsername,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      beforeState: params.beforeState,
      afterState: params.afterState,
      sourceIp: params.sourceIp,
      userAgent: params.userAgent,
      result: params.result || 'success',
      errorMessage: params.errorMessage,
      correlationId,
      previousHash,
      integrityHash,
      createdAt: timestamp,
    });
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err);
  }
}
