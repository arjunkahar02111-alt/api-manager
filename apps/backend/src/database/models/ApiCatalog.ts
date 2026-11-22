import mongoose, { Schema, Document } from 'mongoose';
import type { IApiCatalog } from '@arjun/types';

export interface ApiCatalogDocument extends Omit<IApiCatalog, '_id'>, Document {}

const ApiCatalogSchema = new Schema<ApiCatalogDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, index: true, default: 'General' },
    version: { type: String, default: 'v1' },
    gatewayPath: { type: String, required: true, unique: true, index: true },
    upstreamBaseUrl: { type: String, required: true },
    upstreamPath: { type: String, default: '' },
    allowedMethods: {
      type: [String],
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      default: ['GET'],
    },
    requestSchema: { type: Schema.Types.Mixed },
    responseSchema: { type: Schema.Types.Mixed },
    timeoutMs: { type: Number, default: 15000 },
    maxRequestBytes: { type: Number, default: 10485760 },
    maxResponseBytes: { type: Number, default: 10485760 },
    cachePolicy: {
      enabled: { type: Boolean, default: false },
      ttlSeconds: { type: Number, default: 60 },
      cacheMethods: { type: [String], default: ['GET'] },
      respectUpstreamCacheControl: { type: Boolean, default: true },
    },
    authConfig: {
      type: {
        type: String,
        enum: ['none', 'api_key_query', 'api_key_header', 'bearer_token', 'basic_auth', 'custom_header'],
        default: 'none',
      },
      paramName: { type: String },
      encryptedCredential: { type: String },
      credentialPrefix: { type: String },
      headerFormat: { type: String },
      basicUsername: { type: String },
    },
    parameterDefinitions: { type: Schema.Types.Mixed, default: [] },
    parameterMappings: { type: Schema.Types.Mixed, default: [] },
    requestBodyType: {
      type: String,
      enum: ['none', 'json', 'form-urlencoded', 'multipart', 'text', 'xml'],
      default: 'none',
    },
    responseEnvelope: {
      type: String,
      enum: ['preserve', 'wrap', 'header_only'],
      default: 'preserve',
    },
    validationStatus: {
      type: String,
      enum: ['PASS', 'FAIL', 'WARNING', 'BLOCKED', 'NOT_TESTED'],
      default: 'NOT_TESTED',
    },
    lastValidationReport: { type: Schema.Types.Mixed },
    originalCurl: { type: String },
    sampleRequest: { type: Schema.Types.Mixed },
    sampleResponse: { type: Schema.Types.Mixed },
    authenticationRequired: { type: Boolean, default: true },
    allowedHeaders: { type: [String], default: ['Content-Type', 'Accept', 'User-Agent'] },
    healthCheck: {
      enabled: { type: Boolean, default: true },
      endpointPath: { type: String, default: '/health' },
      intervalSeconds: { type: Number, default: 60 },
      lastStatus: { type: String, enum: ['healthy', 'unhealthy', 'unknown'], default: 'unknown' },
      lastLatencyMs: { type: Number },
      lastCheckedAt: { type: Date },
      failureCount: { type: Number, default: 0 },
      uptimePercentage: { type: Number, default: 100 },
    },
    status: { type: String, enum: ['active', 'disabled', 'maintenance'], default: 'active', index: true },
    allowedPlans: { type: [String], default: ['*'] },
  },
  { timestamps: true }
);

export const ApiCatalog = mongoose.model<ApiCatalogDocument>('ApiCatalog', ApiCatalogSchema, 'api_catalog');
