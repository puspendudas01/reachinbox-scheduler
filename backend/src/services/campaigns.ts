import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { enqueueEmails } from '../queues/email-queue';
import { requestEmailSearchSync } from './email-search';

export interface ScheduleCampaign {
  subject: string;
  body: string;
  emails: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}

export async function scheduleCampaign(
  userId: string,
  { emails, ...details }: ScheduleCampaign,
) {
  const campaign = await prisma.campaign.create({
    data: {
      ...details,
      userId,
      emails: {
        createMany: {
          data: emails.map((toEmail, index) => ({
            userId,
            toEmail,
            subject: details.subject,
            body: details.body,
            scheduledAt: new Date(
              details.startTime.getTime() + index * details.delayMs,
            ),
          })),
        },
      },
    },
    select: { id: true, emails: { select: { id: true, scheduledAt: true } } },
  });

  requestEmailSearchSync();
  campaign.emails.sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  try {
    await enqueueEmails(campaign.emails);
  } catch (error) {
    // The durable scheduled rows will be picked up by reconciliation.
    logger.error(
      { err: error, campaignId: campaign.id },
      'Campaign enqueue failed',
    );
  }

  return { campaignId: campaign.id, scheduledCount: campaign.emails.length };
}
