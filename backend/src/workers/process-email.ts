import { DelayedError, type Job } from 'bullmq';
import { prisma } from '../db/prisma';
import { MAX_ATTEMPTS, type EmailJob } from '../queues/email-queue';
import {
  emailSearchChanged,
  requestEmailSearchSync,
} from '../services/email-search';
import { onRateLimitHit } from '../services/rate-limit-hook';
import { reserveSender } from '../services/rate-limit';

export async function processEmail(job: Job<EmailJob>, token?: string) {
  const { emailId } = job.data;
  const outcome = await prisma.$transaction(
    async (tx) => {
      // Keep cancellation and competing workers serialized through the SMTP call.
      await tx.$queryRaw`SELECT id FROM "Email" WHERE id = ${emailId}::uuid FOR UPDATE`;
      const email = await tx.email.findUnique({
        where: { id: emailId },
        include: { campaign: { select: { hourlyLimit: true } } },
      });
      if (email?.status !== 'scheduled') return;
      if (email.scheduledAt.getTime() > Date.now()) {
        return { retryAt: email.scheduledAt };
      }
      if (email.attempts >= MAX_ATTEMPTS) {
        await tx.email.update({
          where: { id: emailId },
          data: { status: 'failed', ...emailSearchChanged },
        });
        return { searchChanged: true };
      }

      const senders = await tx.sender.findMany({ orderBy: { id: 'asc' } });
      if (!senders.length) throw new Error('No sender accounts are available');
      const { senderIndex, retryAt } = await reserveSender(
        senders.map(({ id }) => id),
        email.campaign.hourlyLimit,
        email.scheduledAt,
      );
      const sender = senders[senderIndex];
      if (!sender)
        throw new Error('Redis returned an invalid sender reservation');

      if (retryAt) {
        await tx.email.update({
          where: { id: emailId },
          data: { scheduledAt: retryAt, ...emailSearchChanged },
        });
        return {
          retryAt,
          searchChanged: true,
          rateLimit: { senderId: sender.id, userId: email.userId },
        };
      }

      const attempts = email.attempts + 1;
      const { default: nodemailer } = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        auth: { user: sender.user, pass: sender.pass },
        disableFileAccess: true,
        disableUrlAccess: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });

      let previewUrl: string | null;
      try {
        const info = await transport.sendMail({
          from: sender.email,
          to: email.toEmail,
          subject: email.subject,
          text: email.body,
          messageId: `<${email.id}@reachinbox-scheduler>`,
          signal: AbortSignal.timeout(35_000),
        });
        previewUrl = nodemailer.getTestMessageUrl(info) || null;
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        const final =
          attempts >= MAX_ATTEMPTS || job.attemptsMade + 1 >= MAX_ATTEMPTS;
        await tx.email.update({
          where: { id: emailId },
          data: {
            senderId: sender.id,
            attempts,
            status: final ? 'failed' : 'scheduled',
            error: failure.message,
            ...(final ? emailSearchChanged : {}),
          },
        });
        return { failure, searchChanged: final };
      } finally {
        transport.close();
      }

      await tx.email.update({
        where: { id: emailId },
        data: {
          senderId: sender.id,
          attempts,
          status: 'sent',
          sentAt: new Date(),
          error: null,
          previewUrl,
          ...emailSearchChanged,
        },
      });
      return { searchChanged: true };
    },
    { timeout: 45_000 },
  );

  if (outcome?.searchChanged) requestEmailSearchSync();
  if (outcome?.failure) throw outcome.failure;
  if (outcome?.retryAt) {
    await job.moveToDelayed(outcome.retryAt.getTime(), token);
    if (outcome.rateLimit) {
      const { senderId, userId } = outcome.rateLimit;
      void onRateLimitHit(senderId, userId);
    }
    throw new DelayedError();
  }
}
