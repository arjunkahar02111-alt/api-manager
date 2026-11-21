import { getRedisClient } from './redis.service.js';
import { logAdminAction } from './audit.service.js';

export interface MaintenanceStatus {
  global: boolean;
  gateway: boolean;
  customerDashboard: boolean;
  message: string;
}

export class MaintenanceService {
  private static KEY = 'system:maintenance';

  static async getStatus(): Promise<MaintenanceStatus> {
    const redis = getRedisClient();
    const raw = await redis.get(this.KEY);
    if (!raw) {
      return {
        global: false,
        gateway: false,
        customerDashboard: false,
        message: 'System is under scheduled maintenance. Please try again soon.',
      };
    }
    try {
      return JSON.parse(raw);
    } catch {
      return {
        global: false,
        gateway: false,
        customerDashboard: false,
        message: 'System is under scheduled maintenance.',
      };
    }
  }

  static async setMaintenance(
    status: Partial<MaintenanceStatus>,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ): Promise<MaintenanceStatus> {
    const current = await this.getStatus();
    const updated: MaintenanceStatus = {
      ...current,
      ...status,
    };

    const redis = getRedisClient();
    await redis.set(this.KEY, JSON.stringify(updated));

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'MAINTENANCE_MODE_UPDATED',
      resourceType: 'system',
      resourceId: 'maintenance',
      beforeState: current as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
      sourceIp,
      result: 'success',
    });

    return updated;
  }
}
