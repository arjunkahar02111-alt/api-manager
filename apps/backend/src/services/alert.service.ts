import crypto from 'node:crypto';
import { Alert, IAlert, AlertSeverity, AlertType } from '../database/models/index.js';
import { SocketService } from './socket.service.js';
import { NotFoundError } from '@arjun/shared';

export interface CreateAlertInput {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source?: 'gateway' | 'backend' | 'worker' | 'system';
  affectedApi?: string;
  affectedClient?: string;
  relatedRequestId?: string;
  metadata?: Record<string, any>;
  cooldownMinutes?: number;
}

export class AlertService {
  /**
   * Generates a deterministic deduplication fingerprint
   */
  private static computeFingerprint(data: CreateAlertInput): string {
    const raw = `${data.source || 'system'}:${data.type}:${data.affectedApi || '*'}:${data.affectedClient || '*'}:${data.title}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Creates an intelligent alert with automatic cooldown deduplication
   */
  static async triggerAlert(data: CreateAlertInput) {
    const fingerprint = this.computeFingerprint(data);
    const cooldownMs = (data.cooldownMinutes ?? 15) * 60 * 1000;
    const cooldownThreshold = new Date(Date.now() - cooldownMs);

    // Look for active existing alert with same fingerprint created within cooldown window
    const existing = await Alert.findOne({
      fingerprint,
      status: 'active',
      lastSeenAt: { $gte: cooldownThreshold },
    });

    if (existing) {
      existing.occurrencesCount += 1;
      existing.lastSeenAt = new Date();
      existing.message = data.message;
      if (data.metadata) {
        existing.metadata = { ...existing.metadata, ...data.metadata };
      }
      await existing.save();

      SocketService.broadcastToAdmin('alert:updated', existing);
      return { alert: existing, deduplicated: true };
    }

    // Otherwise create fresh alert
    const alertId = `ALT-${Date.now().toString().slice(-6)}`;
    const alert = await Alert.create({
      alertId,
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      source: data.source || 'system',
      affectedApi: data.affectedApi,
      affectedClient: data.affectedClient,
      relatedRequestId: data.relatedRequestId,
      metadata: data.metadata,
      status: 'active',
      fingerprint,
      occurrencesCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });

    SocketService.broadcastToAdmin('alert:created', alert);
    return { alert, deduplicated: false };
  }

  /**
   * List alerts with filtering and pagination
   */
  static async listAlerts(query: {
    status?: string;
    severity?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 30));

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;
    if (query.type) filter.type = query.type;

    const total = await Alert.countDocuments(filter);
    const alerts = await Alert.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Acknowledge an alert
   */
  static async acknowledgeAlert(alertId: string, adminUsername: string) {
    const alert = await Alert.findOne({ alertId });
    if (!alert) throw new NotFoundError('Alert not found');

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = adminUsername;
    await alert.save();

    SocketService.broadcastToAdmin('alert:acknowledged', alert);
    return alert;
  }

  /**
   * Resolve an alert
   */
  static async resolveAlert(alertId: string, adminUsername: string, resolutionNotes?: string) {
    const alert = await Alert.findOne({ alertId });
    if (!alert) throw new NotFoundError('Alert not found');

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = adminUsername;
    if (resolutionNotes) alert.resolutionNotes = resolutionNotes;
    await alert.save();

    SocketService.broadcastToAdmin('alert:resolved', alert);
    return alert;
  }

  /**
   * Count active alerts summary
   */
  static async getSummary() {
    const [critical, warning, info, totalActive] = await Promise.all([
      Alert.countDocuments({ status: 'active', severity: 'critical' }),
      Alert.countDocuments({ status: 'active', severity: 'warning' }),
      Alert.countDocuments({ status: 'active', severity: 'info' }),
      Alert.countDocuments({ status: 'active' }),
    ]);

    return { critical, warning, info, totalActive };
  }
}
