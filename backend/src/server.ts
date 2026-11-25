import { once } from 'node:events';
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { requireAuth, requireTrustedOrigin } from './middlewares/auth';
import { errorHandler } from './middlewares/error-handler';
import {
  closeEmailQueue,
  emailRedis,
  reconcileEmailJobs,
} from './queues/email-queue';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { createQueueBoardRouter, QUEUE_BOARD_PATH } from './routes/queue-board';
import { createSchedulerRouter } from './routes/scheduler';
import { slackRouter } from './routes/slack';
import {
  closeEmailSearch,
  requestEmailSearchSync,
} from './services/email-search';

function closeResources() {
  return Promise.allSettled([
    closeEmailQueue(),
    closeEmailSearch().finally(() => prisma.$disconnect()),
  ]);
}

async function startServer() {
  await prisma.$connect();
  await emailRedis.ping();
  await reconcileEmailJobs();
  requestEmailSearchSync();

  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({ origin: new URL(env.FRONTEND_URL).origin, credentials: true }),
  );
  app.use(express.json());
  app.use(healthRouter);
  app.use(QUEUE_BOARD_PATH, createQueueBoardRouter());
  app.use('/api', requireTrustedOrigin);
  app.use('/api/auth', authRouter);
  app.use('/api/slack', slackRouter);
  app.use('/api', createSchedulerRouter(requireAuth));
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not Found' });
  });
  app.use(errorHandler);

  const server = app.listen(env.PORT);
  await once(server, 'listening');
  logger.info({ port: env.PORT }, 'API listening');

  function shutdown(signal: NodeJS.Signals) {
    if (!server.listening) return;
    logger.info({ signal }, 'API shutting down');
    server.close((error) => {
      if (error) {
        logger.error({ err: error }, 'API shutdown failed');
        process.exitCode = 1;
      }
      void closeResources().then(() => {
        logger.info('API stopped');
      });
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void startServer().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'API server failed to start');
  process.exitCode = 1;
  await closeResources();
});
