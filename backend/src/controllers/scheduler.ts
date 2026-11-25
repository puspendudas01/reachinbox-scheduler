import { EmailStatus } from '@prisma/client';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { scheduleCampaign } from '../services/campaigns';
import { searchEmails } from '../services/email-search';
import {
  cancelEmail,
  listScheduledEmails,
  listSentEmails,
} from '../services/emails';

const maxPgInt = 2_147_483_647;
const maxDateMs = 8_640_000_000_000_000;

const scheduleSchema = z
  .object({
    subject: z.string().trim().min(1),
    body: z
      .string()
      .refine((value) => value.trim().length > 0, 'Body is required'),
    emails: z.array(z.string().trim().toLowerCase().pipe(z.email())).min(1),
    startTime: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    delayMs: z.int().min(0).max(maxPgInt),
    hourlyLimit: z.int().min(1).max(maxPgInt),
  })
  .superRefine(({ emails, startTime, delayMs }, context) => {
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: 'custom',
        path: ['emails'],
        message: 'Recipients must be unique',
      });
    }
    const lastScheduledMs = startTime.getTime() + (emails.length - 1) * delayMs;
    if (!Number.isFinite(lastScheduledMs) || lastScheduledMs > maxDateMs) {
      context.addIssue({
        code: 'custom',
        path: ['delayMs'],
        message: 'Schedule exceeds the supported date range',
      });
    }
  });

export const postScheduleCampaign: RequestHandler = async (
  request,
  response,
) => {
  const input = scheduleSchema.safeParse(request.body);
  if (!input.success) {
    response.status(400).json({
      error: 'Invalid campaign',
      issues: input.error.issues.map(({ path, message }) => ({
        path,
        message,
      })),
    });
    return;
  }

  const result = await scheduleCampaign(response.locals.userId, input.data);
  response.status(202).json(result);
};

export const getScheduledEmails: RequestHandler = async (
  _request,
  response,
) => {
  response.json(await listScheduledEmails(response.locals.userId));
};

export const getSentEmails: RequestHandler = async (_request, response) => {
  response.json(await listSentEmails(response.locals.userId));
};

const searchQuery = z.object({
  q: z.string().trim().default(''),
  status: z.union([z.enum(EmailStatus), z.literal('')]).optional(),
});

export const getSearchEmails: RequestHandler = async (request, response) => {
  const query = searchQuery.safeParse(request.query);
  if (!query.success) {
    response.status(400).json({ error: 'Invalid search query or status' });
    return;
  }
  const { q, status } = query.data;
  response.json(
    await searchEmails(response.locals.userId, q, status || undefined),
  );
};

export const postCancelEmail: RequestHandler = async (request, response) => {
  const id = z.uuid().safeParse(request.params.id);
  if (!id.success) {
    response.status(400).json({ error: 'Invalid email ID' });
    return;
  }
  response.json(await cancelEmail(response.locals.userId, id.data));
};
