import mongoose, { Schema, Document } from 'mongoose';
import type { IRequestLog } from '@arjun/types';

export interface RequestLogDocument extends Omit<IRequestLog, '_id'>, Document {}

const RequestLogSchema = new Schema<RequestLogDocument>(
  {
    requestId: { type: String, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    apiId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'ApiCatalog', required: true, index: true },
    method: { type: String, required: true },
    endpoint: { type: String, required: true, index: true },
    sourceIp: { type: String, required: true },
    statusCode: { type: Number, required: true, index: true },
    upstreamStatus: { type: Number },
    durationMs: { type: Number, required: true },
    requestBytes: { type: Number, default: 0 },
    responseBytes: { type: Number, default: 0 },
    timestamp: { type: Date, required: true, index: true },
    errorCode: { type: String },
    userAgent: { type: String },
  },
  { timestamps: false }
);

// Compound indexes for fast admin and customer filtering
RequestLogSchema.index({ customerId: 1, timestamp: -1 });
RequestLogSchema.index({ apiId: 1, timestamp: -1 });
RequestLogSchema.index({ statusCode: 1, timestamp: -1 });

export const RequestLog = mongoose.model<RequestLogDocument>('RequestLog', RequestLogSchema, 'request_logs');
