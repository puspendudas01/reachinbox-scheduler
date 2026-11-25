import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { emailQueue } from '../queues/email-queue';
import { HttpError } from '../utils/http-error';
import { emailSearchChanged, requestEmailSearchSync } from './email-search';

const omitSearchState = { searchDirty: true, searchVersion: true } as const;

export function listScheduledEmails(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: 'scheduled' },
    omit: omitSearchState,
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
  });
}

export function listSentEmails(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: { in: ['sent', 'failed'] } },
    omit: omitSearchState,
    orderBy: [
      { sentAt: { sort: 'desc', nulls: 'last' } },
      { scheduledAt: 'desc' },
      { id: 'asc' },
    ],
  });
}

export async function cancelEmail(userId: string, id: string) {
  const updated = await prisma.email.updateMany({
    where: { id, userId, status: 'scheduled' },
    data: { status: 'cancelled', ...emailSearchChanged },
  });
  if (!updated.count) {
    const email = await prisma.email.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!email) throw new HttpError(404, 'Email not found');
    if (email.status !== 'cancelled') {
      throw new HttpError(409, 'Only scheduled emails can be cancelled');
    }
  }
  if (updated.count) requestEmailSearchSync();

  try {
    const job = await emailQueue.getJob(id);
    if (job && !(await job.isActive())) await job.remove();
  } catch (error) {
    logger.warn({ err: error, emailId: id }, 'Could not remove cancelled job');
  }

  return { id, status: 'cancelled' };
}
