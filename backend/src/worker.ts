import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import {
  closeEmailQueue,
  EMAIL_QUEUE_NAME,
  emailRedis,
  type EmailJob,
  reconcileEmailJobs,
  recordFailedJob,
} from './queues/email-queue';
import {
  closeEmailSearch,
  requestEmailSearchSync,
} from './services/email-search';
import { provisionEtherealSenders } from './services/senders';
import { processEmail } from './workers/process-email';

function closeResources() {
  return Promise.allSettled([
    closeEmailQueue(),
    closeEmailSearch().finally(() => prisma.$disconnect()),
  ]);
}

async function startWorker() {
  await emailRedis.ping();
  await provisionEtherealSenders();
  await reconcileEmailJobs();
  requestEmailSearchSync();

  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const worker = new Worker<EmailJob>(EMAIL_QUEUE_NAME, processEmail, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    ...(env.MIN_DELAY_BETWEEN_EMAILS_MS > 0 && {
      limiter: { max: 1, duration: env.MIN_DELAY_BETWEEN_EMAILS_MS },
    }),
  });

  worker.on('error', (error) => {
    logger.error({ err: error }, 'Email worker error');
  });
  worker.on('failed', (job, error) => {
    if (!job) return;
    void job
      .isFailed()
      .then(async (terminal) => {
        if (terminal) await recordFailedJob(job.data.emailId, error.message);
      })
      .catch((recordError: unknown) => {
        logger.error(
          { err: recordError, emailId: job.data.emailId },
          'Could not record failed job',
        );
      });
  });

  try {
    await worker.waitUntilReady();
  } catch (error) {
    await worker.close(true).finally(() => connection.disconnect());
    throw error;
  }

  let reconciliation: Promise<void> | undefined;
  const timer = setInterval(() => {
    requestEmailSearchSync();
    reconciliation ??= reconcileEmailJobs()
      .catch((error: unknown) => {
        logger.error({ err: error }, 'Email reconciliation failed');
      })
      .finally(() => {
        reconciliation = undefined;
      });
  }, 60_000);

  let shuttingDown = false;
  async function shutdown(signal: NodeJS.Signals) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(timer);
    logger.info({ signal }, 'Worker shutting down');
    try {
      await worker.close();
      await reconciliation;
      logger.info('Worker stopped');
    } catch (error) {
      logger.error({ err: error }, 'Worker shutdown failed');
      process.exitCode = 1;
    } finally {
      connection.disconnect();
      await closeResources();
    }
  }

  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));

  logger.info({ concurrency: env.WORKER_CONCURRENCY }, 'Worker ready');
}

void startWorker().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Email worker failed to start');
  process.exitCode = 1;
  await closeResources();
});
