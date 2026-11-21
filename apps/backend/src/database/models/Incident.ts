import mongoose, { Schema, Document } from 'mongoose';

export type IncidentSeverity = 'SEV-1' | 'SEV-2' | 'SEV-3' | 'SEV-4';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export interface IncidentTimelineEntry {
  timestamp: Date;
  author: string;
  message: string;
  status?: IncidentStatus;
}

export interface IIncident {
  incidentId: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedApis: string[];
  affectedEndpoints: string[];
  clientImpact: 'none' | 'degraded' | 'critical';
  linkedAnnouncementId?: string;
  maintenanceEnabled: boolean;
  startedAt: Date;
  resolvedAt?: Date;
  durationMinutes?: number;
  timeline: IncidentTimelineEntry[];
  resolutionNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IncidentDocument extends IIncident, Document {}

const IncidentTimelineSchema = new Schema<IncidentTimelineEntry>(
  {
    timestamp: { type: Date, default: Date.now },
    author: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved'] },
  },
  { _id: false }
);

const IncidentSchema = new Schema<IncidentDocument>(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    severity: {
      type: String,
      enum: ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'],
      default: 'SEV-3',
      index: true,
    },
    status: {
      type: String,
      enum: ['investigating', 'identified', 'monitoring', 'resolved'],
      default: 'investigating',
      index: true,
    },
    affectedApis: { type: [String], default: [] },
    affectedEndpoints: { type: [String], default: [] },
    clientImpact: {
      type: String,
      enum: ['none', 'degraded', 'critical'],
      default: 'degraded',
    },
    linkedAnnouncementId: { type: String },
    maintenanceEnabled: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    durationMinutes: { type: Number },
    timeline: { type: [IncidentTimelineSchema], default: [] },
    resolutionNotes: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Incident = mongoose.model<IncidentDocument>('Incident', IncidentSchema, 'incidents');
