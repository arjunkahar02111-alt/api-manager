import { Incident, IncidentSeverity, IncidentStatus, ApiCatalog } from '../database/models/index.js';
import { SocketService } from './socket.service.js';
import { logAdminAction } from './audit.service.js';
import { getRedisClient } from './redis.service.js';
import { NotFoundError } from '@arjun/shared';

export interface CreateIncidentInput {
  title: string;
  description: string;
  severity: IncidentSeverity;
  affectedApis?: string[];
  affectedEndpoints?: string[];
  clientImpact?: 'none' | 'degraded' | 'critical';
  maintenanceEnabled?: boolean;
}

export class IncidentService {
  /**
   * Create an internal SOC incident
   */
  static async createIncident(data: CreateIncidentInput, adminId: string, adminUsername: string, sourceIp: string) {
    const count = await Incident.countDocuments();
    const incidentId = `INC-${(count + 1001).toString()}`;

    const incident = await Incident.create({
      incidentId,
      title: data.title,
      description: data.description,
      severity: data.severity || 'SEV-3',
      status: 'investigating',
      affectedApis: data.affectedApis || [],
      affectedEndpoints: data.affectedEndpoints || [],
      clientImpact: data.clientImpact || 'degraded',
      maintenanceEnabled: data.maintenanceEnabled || false,
      startedAt: new Date(),
      timeline: [
        {
          timestamp: new Date(),
          author: adminUsername,
          message: `Incident declared as ${data.severity || 'SEV-3'}: ${data.title}`,
          status: 'investigating',
        },
      ],
      createdBy: adminUsername,
    });

    // If maintenance was requested for affected APIs, enable maintenance mode in catalog and Redis
    if (data.maintenanceEnabled && data.affectedApis && data.affectedApis.length > 0) {
      await ApiCatalog.updateMany(
        { slug: { $in: data.affectedApis } },
        { status: 'maintenance', maintenanceMessage: `Incident ${incidentId}: ${data.title}` }
      );
      const redis = getRedisClient();
      for (const slug of data.affectedApis) {
        await redis.del(`gateway:route:${slug}`);
        await redis.set(`api:maintenance:${slug}`, `Incident ${incidentId}: ${data.title}`);
      }
    }

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'INCIDENT_CREATED',
      resourceType: 'incident',
      resourceId: incidentId,
      afterState: { incidentId, severity: data.severity, affectedApis: data.affectedApis },
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('incident:created', incident);
    return incident;
  }

  /**
   * List incidents with status and severity filters
   */
  static async listIncidents(query: { status?: string; severity?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.severity) filter.severity = query.severity;

    const total = await Incident.countDocuments(filter);
    const incidents = await Incident.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      incidents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single incident by incidentId
   */
  static async getIncident(incidentId: string) {
    const incident = await Incident.findOne({ incidentId });
    if (!incident) throw new NotFoundError('Incident not found');
    return incident;
  }

  /**
   * Update incident state and append to timeline
   */
  static async updateIncident(
    incidentId: string,
    update: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      message: string;
      maintenanceEnabled?: boolean;
    },
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const incident = await Incident.findOne({ incidentId });
    if (!incident) throw new NotFoundError('Incident not found');

    if (update.status) incident.status = update.status;
    if (update.severity) incident.severity = update.severity;

    incident.timeline.push({
      timestamp: new Date(),
      author: adminUsername,
      message: update.message,
      status: update.status || incident.status,
    });

    if (update.maintenanceEnabled !== undefined) {
      incident.maintenanceEnabled = update.maintenanceEnabled;
    }

    await incident.save();

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'INCIDENT_UPDATED',
      resourceType: 'incident',
      resourceId: incidentId,
      afterState: { status: incident.status, severity: incident.severity },
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('incident:updated', incident);
    return incident;
  }

  /**
   * Resolve an incident and optionally restore services from maintenance
   */
  static async resolveIncident(
    incidentId: string,
    resolutionNotes: string,
    restoreServices: boolean,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const incident = await Incident.findOne({ incidentId });
    if (!incident) throw new NotFoundError('Incident not found');

    const resolvedAt = new Date();
    const durationMinutes = Math.max(1, Math.round((resolvedAt.getTime() - incident.startedAt.getTime()) / 60000));

    incident.status = 'resolved';
    incident.resolvedAt = resolvedAt;
    incident.durationMinutes = durationMinutes;
    incident.resolutionNotes = resolutionNotes;
    incident.timeline.push({
      timestamp: resolvedAt,
      author: adminUsername,
      message: `Incident resolved: ${resolutionNotes}`,
      status: 'resolved',
    });

    await incident.save();

    // Optionally restore affected APIs
    if (restoreServices && incident.affectedApis.length > 0) {
      await ApiCatalog.updateMany(
        { slug: { $in: incident.affectedApis }, status: 'maintenance' },
        { status: 'active', maintenanceMessage: undefined }
      );
      const redis = getRedisClient();
      for (const slug of incident.affectedApis) {
        await redis.del(`gateway:route:${slug}`);
        await redis.del(`api:maintenance:${slug}`);
      }
    }

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'INCIDENT_RESOLVED',
      resourceType: 'incident',
      resourceId: incidentId,
      afterState: { durationMinutes, resolutionNotes },
      sourceIp,
      result: 'success',
    });

    SocketService.broadcastToAdmin('incident:resolved', incident);
    return incident;
  }
}
