import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { emailRedis } from '../queues/email-queue';
import { getUtcHourWindow } from './rate-limit';

export async function onRateLimitHit(senderId: string, userId: string) {
  try {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: { webhookUrl: true },
    });
    if (!connection) return;

    const window = getUtcHourWindow();
    const allowed = await emailRedis.set(
      `slack:rate-limit:${userId}:${senderId}:${window.key}`,
      '1',
      'EX',
      Math.max(1, Math.ceil((window.end - Date.now()) / 1_000)),
      'NX',
    );
    if (!allowed) return;

    const response = await fetch(connection.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `ReachInbox sender ${senderId} reached its hourly email limit. Pending emails will resume after ${new Date(window.end).toISOString()}.`,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    await response.body?.cancel();
    if (!response.ok) {
      logger.warn(
        { senderId, userId, status: response.status },
        'Slack webhook rejected rate-limit notification',
      );
    }
  } catch {
    logger.warn({ senderId, userId }, 'Slack rate-limit notification failed');
  }
}
