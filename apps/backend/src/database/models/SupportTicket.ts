import mongoose, { Schema, Document } from 'mongoose';
import type { ISupportTicket } from '@arjun/types';

export interface SupportTicketDocument extends Omit<ISupportTicket, '_id'>, Document {}

const SupportTicketMessageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    senderRole: { type: String, enum: ['customer', 'admin'], required: true },
    senderName: { type: String, required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SupportTicketSchema = new Schema<SupportTicketDocument>(
  {
    customerId: { type: Schema.Types.ObjectId as unknown as typeof String, ref: 'Customer', required: true, index: true },
    customerUsername: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium', index: true },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    messages: { type: [SupportTicketMessageSchema], default: [] },
    attachments: { type: [String], default: [] },
    internalNotes: { type: String },
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<SupportTicketDocument>('SupportTicket', SupportTicketSchema, 'support_tickets');
