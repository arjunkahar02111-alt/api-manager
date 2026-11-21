import { Router } from 'express';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth.js';
import { SupportTicket } from '../../database/models/index.js';
import { UpdateTicketStatusSchema, ReplySupportTicketSchema } from '@arjun/schemas';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireAdminAuth);

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const tickets = await SupportTicket.find(query).sort({ updatedAt: -1 });
    return sendSuccess(res, tickets);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new NotFoundError('Ticket not found');
    return sendSuccess(res, ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/replies', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { message } = ReplySupportTicketSchema.parse(req.body);
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new NotFoundError('Ticket not found');

    ticket.messages.push({
      senderId: req.admin!.id,
      senderRole: 'admin',
      senderName: req.admin!.username,
      message,
      createdAt: new Date(),
    });
    ticket.status = 'waiting_for_customer';
    await ticket.save();

    return sendSuccess(res, ticket, 'Reply posted successfully');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { status, priority, internalNotes } = UpdateTicketStatusSchema.parse(req.body);
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) throw new NotFoundError('Ticket not found');

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (internalNotes !== undefined) ticket.internalNotes = internalNotes;
    await ticket.save();

    return sendSuccess(res, ticket, 'Ticket updated successfully');
  } catch (err) {
    next(err);
  }
});

export default router;
