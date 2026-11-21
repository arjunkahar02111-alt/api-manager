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
}

export async function logAdminAction(params: AuditLogParams): Promise<void> {
  try {
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
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err);
  }
}
