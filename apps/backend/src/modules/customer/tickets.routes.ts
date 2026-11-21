import { Router } from 'express';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from '../../middleware/customerAuth.js';
import { SupportTicket } from '../../database/models/index.js';
import { CreateSupportTicketSchema, ReplySupportTicketSchema } from '@arjun/schemas';
import { sendSuccess, NotFoundError } from '@arjun/shared';

const router = Router();

router.use(requireCustomerAuth);

router.get('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const tickets = await SupportTicket.find({ customerId: req.customer!.customerId }).sort({ updatedAt: -1 });
    return sendSuccess(res, tickets);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { subject, category, priority, message } = CreateSupportTicketSchema.parse(req.body);

    const ticket = await SupportTicket.create({
      customerId: req.customer!.customerId,
      customerUsername: req.customer!.username,
      subject,
      category,
      priority,
      status: 'open',
      messages: [
        {
          senderId: req.customer!.customerId,
          senderRole: 'customer',
          senderName: req.customer!.username,
          message,
          createdAt: new Date(),
        },
      ],
    });

    return sendSuccess(res, ticket, 'Support ticket opened successfully', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      customerId: req.customer!.customerId,
    });
    if (!ticket) throw new NotFoundError('Ticket not found');
    return sendSuccess(res, ticket);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/replies', async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { message } = ReplySupportTicketSchema.parse(req.body);
    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      customerId: req.customer!.customerId,
    });
    if (!ticket) throw new NotFoundError('Ticket not found');

    ticket.messages.push({
      senderId: req.customer!.customerId,
      senderRole: 'customer',
      senderName: req.customer!.username,
      message,
      createdAt: new Date(),
    });
    ticket.status = 'in_progress';
    await ticket.save();

    return sendSuccess(res, ticket, 'Reply sent');
  } catch (err) {
    next(err);
  }
});

export default router;
