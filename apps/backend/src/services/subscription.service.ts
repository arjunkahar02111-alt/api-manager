import { SubscriptionPlan, ManualPayment, Customer } from '../database/models/index.js';
import { NotFoundError } from '@arjun/shared';
import { logAdminAction } from './audit.service.js';

export class SubscriptionService {
  static async listPlans() {
    return SubscriptionPlan.find().sort({ price: 1 });
  }

  static async createPlan(data: any, adminId: string, adminUsername: string, sourceIp: string) {
    const plan = await SubscriptionPlan.create(data);
    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'PLAN_CREATED',
      resourceType: 'subscription_plan',
      resourceId: plan._id.toString(),
      afterState: plan.toObject() as any,
      sourceIp,
      result: 'success',
    });
    return plan;
  }

  static async updatePlan(id: string, updates: any, _adminId: string, _adminUsername: string, _sourceIp: string) {
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) throw new NotFoundError('Plan not found');
    Object.assign(plan, updates);
    await plan.save();
    return plan;
  }

  static async recordManualPayment(data: any, adminId: string, adminUsername: string, sourceIp: string) {
    const customer = await Customer.findById(data.customerId);
    if (!customer) throw new NotFoundError('Customer not found');

    const payment = await ManualPayment.create({
      ...data,
      status: 'pending',
    });

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: 'MANUAL_PAYMENT_RECORDED',
      resourceType: 'manual_payment',
      resourceId: payment._id.toString(),
      afterState: payment.toObject() as any,
      sourceIp,
      result: 'success',
    });

    return payment;
  }

  static async verifyManualPayment(
    paymentId: string,
    status: 'verified' | 'rejected',
    notes: string | undefined,
    extendDays: number | undefined,
    adminId: string,
    adminUsername: string,
    sourceIp: string
  ) {
    const payment = await ManualPayment.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment record not found');

    payment.status = status;
    payment.verifiedBy = adminUsername;
    payment.verifiedAt = new Date();
    if (notes) payment.notes = notes;
    await payment.save();

    if (status === 'verified' && extendDays && extendDays > 0) {
      const customer = await Customer.findById(payment.customerId);
      if (customer) {
        const base = customer.expiresAt.getTime() > Date.now() ? customer.expiresAt.getTime() : Date.now();
        customer.expiresAt = new Date(base + extendDays * 24 * 60 * 60 * 1000);
        if (customer.status === 'expired') customer.status = 'active';
        await customer.save();
      }
    }

    await logAdminAction({
      administratorId: adminId,
      administratorUsername: adminUsername,
      action: `MANUAL_PAYMENT_${status.toUpperCase()}`,
      resourceType: 'manual_payment',
      resourceId: payment._id.toString(),
      afterState: { status, notes, extendDays },
      sourceIp,
      result: 'success',
    });

    return payment;
  }
}
