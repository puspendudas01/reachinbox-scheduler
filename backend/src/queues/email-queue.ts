import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import {
  emailSearchChanged,
  requestEmailSearchSync,
} from '../services/email-search';

export const EMAIL_QUEUE_NAME = 'send-email';
export const MAX_ATTEMPTS = 3;

export interface EmailJob {
  emailId: string;
}

export const emailRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1 });
export const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
  connection: emailRedis,
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: true,
  },
});

emailQueue.on('error', (error) => {
  logger.error({ err: error }, 'Email queue error');
});

interface ScheduledEmail {
  id: string;
  scheduledAt: Date;
}

export async function enqueueEmails(emails: ScheduledEmail[]) {
  const timestamp = Date.now();
  await emailQueue.addBulk(
    emails.map(({ id, scheduledAt }) => ({
      name: EMAIL_QUEUE_NAME,
      data: { emailId: id },
      opts: {
        jobId: id,
        timestamp,
        delay: Math.max(0, scheduledAt.getTime() - timestamp),
      },
    })),
  );
}

export async function recordFailedJob(emailId: string, error: string) {
  const updated = await prisma.email.updateMany({
    where: { id: emailId, status: 'scheduled' },
    data: { status: 'failed', error, ...emailSearchChanged },
  });
  if (updated.count) requestEmailSearchSync();
}

export async function reconcileEmailJobs() {
  let cursor: string | undefined;

  // A bounded scan keeps a backlog from flooding either connection.
  for (;;) {
    const pending: ScheduledEmail[] = await prisma.email.findMany({
      where: { status: 'scheduled', ...(cursor && { id: { gt: cursor } }) },
      select: { id: true, scheduledAt: true },
      orderBy: { id: 'asc' },
      take: 250,
    });
    if (!pending.length) return;

    const missing = await Promise.all(
      pending.map(async (email) => {
        const job = await emailQueue.getJob(email.id);
        if (!job) return email;
        if (await job.isFailed()) {
          await recordFailedJob(email.id, job.failedReason);
        }
      }),
    );
    const toEnqueue = missing.filter((email) => email !== undefined);
    if (toEnqueue.length) {
      toEnqueue.sort(
        (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
      );
      await enqueueEmails(toEnqueue);
    }
    cursor = pending.at(-1)?.id;
  }
}

export async function closeEmailQueue() {
  try {
    await emailQueue.close();
  } finally {
    emailRedis.disconnect();
  }
}
