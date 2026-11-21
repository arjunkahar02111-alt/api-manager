import mongoose, { Schema, Document } from 'mongoose';
import type { ICustomerApiPermission } from '@arjun/types';

export interface CustomerApiPermissionDocument extends Omit<ICustomerApiPermission, '_id'>, Document {}

const CustomerApiPermissionSchema = new Schema<CustomerApiPermissionDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    apiId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'ApiCatalog', required: true, index: true },
    enabled: { type: Boolean, default: true },
    customDailyLimit: { type: Number },
    customMonthlyLimit: { type: Number },
    customLifetimeLimit: { type: Number },
    customConcurrencyLimit: { type: Number },
  },
  { timestamps: true }
);

CustomerApiPermissionSchema.index({ customerId: 1, apiId: 1 }, { unique: true });

export const CustomerApiPermission = mongoose.model<CustomerApiPermissionDocument>(
  'CustomerApiPermission',
  CustomerApiPermissionSchema,
  'customer_api_permissions'
);
