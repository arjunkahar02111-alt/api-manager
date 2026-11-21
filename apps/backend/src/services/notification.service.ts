import { config } from '../config/index.js';
import { request } from 'undici';
import { SecurityNotification } from '../database/models/index.js';
import { RealtimeService } from './realtime.service.js';
import type { SecuritySeverity } from '@arjun/types';

const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_WEBHOOK_URL ||
  'https://discord.com/api/webhooks/1471007980484034562/I858won4YW6XqwnhXmGpXu0V3e2R6k5epKbwSCvj4Q72ElLltA51PEaiuJZNBbPIAPWn';

export interface NotificationPayload {
  userId?: string;
  type: string;
  title: string;
  message: string;
  severity?: SecuritySeverity;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Dispatches security alert across:
   * 1. Database (SecurityNotification)
   * 2. Real-time Dashboard stream (SSE & Socket.IO)
   * 3. External Discord Webhook (with rich embed formatting)
   * 4. External Telegram alert (if configured)
   */
  static async notify(payload: NotificationPayload) {
    const severity = payload.severity || 'MEDIUM';

    // 1. Persist notification in database
    let notifDoc;
    try {
      notifDoc = await SecurityNotification.create({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        severity,
        metadata: payload.metadata || {},
      });
    } catch {}

    // 2. Real-time broadcast to connected Dashboards
    RealtimeService.broadcast('security_notification', {
      id: notifDoc?._id?.toString() || Date.now().toString(),
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      severity,
      metadata: payload.metadata,
      createdAt: new Date().toISOString(),
    });

    // 3. Dispatch to Discord Webhook asynchronously
    this.sendDiscordWebhook(payload, severity).catch(() => {});

    // 4. Dispatch Telegram alert for High/Critical severity
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      this.sendTelegramAlert(`<b>${payload.title}</b>\n${payload.message}`).catch(() => {});
    }

    return notifDoc;
  }

  private static async sendDiscordWebhook(payload: NotificationPayload, severity: SecuritySeverity) {
    if (!DISCORD_WEBHOOK_URL) return;

    const colors: Record<SecuritySeverity, number> = {
      CRITICAL: 0xef4444, // Red
      HIGH: 0xf59e0b,     // Orange/Amber
      MEDIUM: 0x3b82f6,   // Blue
      LOW: 0x10b981,      // Green
    };

    const embedFields = [
      { name: 'Incident Type', value: `\`${payload.type}\``, inline: true },
      { name: 'Severity Level', value: `**${severity}**`, inline: true },
      { name: 'Timestamp (UTC)', value: new Date().toISOString(), inline: true },
    ];

    if (payload.metadata?.sourceIp) {
      embedFields.push({ name: 'Source IP', value: `\`${payload.metadata.sourceIp}\``, inline: true });
    }
    if (payload.metadata?.customerUsername) {
      embedFields.push({ name: 'User / Account', value: payload.metadata.customerUsername, inline: true });
    }
    if (payload.metadata?.keyPrefix) {
      embedFields.push({ name: 'Key Prefix', value: `\`${payload.metadata.keyPrefix}\``, inline: true });
    }
    if (payload.metadata?.actionTaken) {
      embedFields.push({ name: 'Automated Defense', value: `\`${payload.metadata.actionTaken}\``, inline: false });
    }

    const discordBody = {
      username: 'ARJUN API SECURITY SENTINEL',
      avatar_url: 'https://api.karviontechnologies.in/shield.png',
      embeds: [
        {
          title: `🛡️ ${payload.title}`,
          description: payload.message,
          color: colors[severity] || 0xffffff,
          fields: embedFields,
          footer: {
            text: 'Arjun API Manager • Enterprise Security Operations Center',
          },
        },
      ],
    };

    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordBody),
        signal: AbortSignal.timeout(5000),
      });
    } catch {}
  }

  /**
   * Dispatch Telegram Bot notification to Super Admin channel/chat
   */
  static async sendTelegramAlert(message: string): Promise<boolean> {
    const { botToken, chatId } = config.telegram;
    if (!botToken || !chatId) {
      // Telegram bot not configured; skip silently
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🚨 [ARJUN API MANAGER]\n${message}`,
          parse_mode: 'HTML',
        }),
      });
      return true;
    } catch (err: any) {
      console.error('[NotificationService] Telegram alert failed:', err.message);
      return false;
    }
  }
}
