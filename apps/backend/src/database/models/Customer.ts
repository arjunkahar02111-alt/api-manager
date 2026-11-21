import mongoose, { Schema, Document } from 'mongoose';
import type { ICustomer } from '@arjun/types';

export interface CustomerDocument extends Omit<ICustomer, '_id'>, Document {}

const CustomerSchema = new Schema<CustomerDocument>(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ['active', 'suspended', 'expired', 'deleted'],
      default: 'active',
      index: true,
    },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    dailyRequestLimit: { type: Number, default: 1000 },
    monthlyRequestLimit: { type: Number, default: 30000 },
    lifetimeRequestLimit: { type: Number, default: 100000 },
    maxConcurrentRequests: { type: Number, default: 10 },
    maxBandwidthBytes: { type: Number, default: 1073741824 }, // 1GB
    allowedApis: { type: [String], default: ['*'] },
    allowedIps: { type: [String], default: [] },
    boundIp: { type: String, trim: true, index: true },
    ipLockStrict: { type: Boolean, default: true },
    autoBanOnKeySharing: { type: Boolean, default: true },
    activeIps: { type: [String], default: [] },
    lastSeenIp: { type: String },
    lastSeenAt: { type: Date },
    keySharingViolations: { type: Number, default: 0 },
    activeSessionId: { type: String },
    passwordHash: { type: String },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    totpEnabled: { type: Boolean, default: false },
    totpSecretEncrypted: { type: String },
    backupCodes: { type: [String], default: [] },
    accountSecurityScore: { type: Number, default: 85 },
    riskScore: { type: Number, default: 0 },
    maxKeys: { type: Number, default: 3 },
    tags: { type: [String], default: [] },
    developerTag: { type: String, default: 'arjunkahar', trim: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    expiresAt: { type: Date, required: true, index: true },
    suspendedAt: { type: Date },
    deletedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ status: 1, expiresAt: 1 });

export const Customer = mongoose.model<CustomerDocument>('Customer', CustomerSchema, 'customers');
