import crypto from 'node:crypto';
import { UserDevice, Customer } from '../database/models/index.js';
import { NotificationService } from './notification.service.js';

export function parseUserAgent(ua?: string): { os: string; browser: string } {
  if (!ua) return { os: 'Unknown OS', browser: 'Unknown Browser' };

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let browser = 'Unknown Browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('curl')) browser = 'cURL';
  else if (ua.includes('python')) browser = 'Python Requests';
  else if (ua.includes('Postman')) browser = 'Postman';

  return { os, browser };
}

export class DeviceService {
  /**
   * Generates a stable fingerprint hash for the client device
   */
  static generateDeviceId(userAgent?: string, ipAddress?: string): string {
    const raw = `${userAgent || 'generic'}-${ipAddress ? ipAddress.split('.').slice(0, 2).join('.') : '0.0'}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  /**
   * Records a login from a client device. If new, notifies user & admin.
   */
  static async recordDeviceLogin(params: {
    userId: string;
    ipAddress: string;
    userAgent?: string;
  }) {
    const { userId, ipAddress, userAgent } = params;
    const deviceId = this.generateDeviceId(userAgent, ipAddress);
    const { os, browser } = parseUserAgent(userAgent);
    const deviceName = `${browser} on ${os}`;

    let device = await UserDevice.findOne({ userId, deviceId });
    const isNewDevice = !device;

    if (!device) {
      device = await UserDevice.create({
        userId,
        deviceId,
        deviceName,
        os,
        browser,
        ipAddress,
        isTrusted: true,
        firstLoginAt: new Date(),
        lastActiveAt: new Date(),
        status: 'active',
      });

      // Dispatch "New Device Login" security alert
      NotificationService.notify({
        userId,
        type: 'NEW_DEVICE_LOGIN',
        title: 'New Device Recognized',
        message: `Login detected from a new device: ${deviceName} (IP: ${ipAddress})`,
        severity: 'MEDIUM',
        metadata: {
          sourceIp: ipAddress,
          deviceName,
          os,
          browser,
        },
      }).catch(() => {});
    } else {
      device.lastActiveAt = new Date();
      device.ipAddress = ipAddress;
      await device.save();
    }

    return device;
  }

  /**
   * List all registered devices for a user
   */
  static async listUserDevices(userId: string) {
    return UserDevice.find({ userId, status: 'active' }).sort({ lastActiveAt: -1 }).lean();
  }

  /**
   * Revoke/remove a device
   */
  static async revokeDevice(userId: string, deviceId: string) {
    return UserDevice.updateOne({ userId, deviceId }, { status: 'revoked' });
  }

  /**
   * Toggle trusted status of a device
   */
  static async setDeviceTrust(userId: string, deviceId: string, isTrusted: boolean) {
    return UserDevice.updateOne({ userId, deviceId }, { isTrusted });
  }
}
