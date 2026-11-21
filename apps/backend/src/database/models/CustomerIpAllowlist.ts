import mongoose, { Schema, Document } from 'mongoose';
import type { ICustomerIpAllowlist } from '@arjun/types';

export interface CustomerIpAllowlistDocument extends Omit<ICustomerIpAllowlist, '_id'>, Document {}

const CustomerIpAllowlistSchema = new Schema<CustomerIpAllowlistDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    cidr: { type: String, required: true, trim: true },
    label: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerIpAllowlistSchema.index({ customerId: 1, cidr: 1 }, { unique: true });

export const CustomerIpAllowlist = mongoose.model<CustomerIpAllowlistDocument>(
  'CustomerIpAllowlist',
  CustomerIpAllowlistSchema,
  'customer_ip_allowlist'
);
