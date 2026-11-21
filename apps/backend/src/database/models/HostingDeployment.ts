import mongoose, { Schema, Document } from 'mongoose';
import type { IHostingDeployment } from '@arjun/types';

export interface HostingDeploymentDocument extends Omit<IHostingDeployment, '_id'>, Document {}

const HostingDeploymentSchema = new Schema<HostingDeploymentDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, default: '' },
    runtime: { type: String, enum: ['nodejs', 'python', 'php', 'custom'], default: 'nodejs' },
    version: { type: String, default: 'latest' },
    port: { type: Number, required: true, unique: true },
    domain: { type: String },
    subdomain: { type: String },
    gatewayPath: { type: String, required: true, unique: true, index: true },
    envVars: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['stopped', 'running', 'building', 'failed'], default: 'stopped', index: true },
    healthStatus: { type: String, enum: ['healthy', 'unhealthy', 'unknown'], default: 'unknown' },
    restartPolicy: { type: String, enum: ['always', 'on-failure', 'never'], default: 'always' },
    memoryLimitMb: { type: Number, default: 512 },
    cpuLimitPercent: { type: Number, default: 50 },
    pid: { type: Number },
    workingDir: { type: String, required: true },
    entryPoint: { type: String, default: 'index.js' },
    errorLog: { type: String },
  },
  { timestamps: true }
);

export const HostingDeployment = mongoose.model<HostingDeploymentDocument>(
  'HostingDeployment',
  HostingDeploymentSchema,
  'hosting_deployments'
);
