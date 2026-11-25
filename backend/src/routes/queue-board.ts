import { createHash, timingSafeEqual } from 'node:crypto';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Router } from 'express';
import { env } from '../config/env';
import { emailQueue } from '../queues/email-queue';

export const QUEUE_BOARD_PATH = '/admin/queues';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function createQueueBoardRouter() {
  const adapter = new ExpressAdapter();
  adapter.setBasePath(QUEUE_BOARD_PATH);
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue, { readOnlyMode: true })],
    serverAdapter: adapter,
  });

  const expected = digest(`${env.BULL_BOARD_USER}:${env.BULL_BOARD_PASS}`);
  const router = Router();
  router.use((request, response, next) => {
    const token = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(
      request.headers.authorization ?? '',
    )?.[1];
    if (
      !token ||
      !timingSafeEqual(
        digest(Buffer.from(token, 'base64').toString()),
        expected,
      )
    ) {
      response
        .set(
          'WWW-Authenticate',
          'Basic realm="ReachInbox queues", charset="UTF-8"',
        )
        .status(401)
        .send('Authentication required');
      return;
    }
    response.set('Cache-Control', 'no-store');
    next();
  });
  router.use(adapter.getRouter());
  return router;
}
