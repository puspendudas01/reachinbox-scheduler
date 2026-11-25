import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middlewares/auth';
import {
  consumeOAuthCookie,
  OAUTH_STATE_SECONDS,
  setOAuthCookie,
  signToken,
  verifyToken,
} from '../services/session';
import { HttpError } from '../utils/http-error';

const redirectUri = new URL('/api/slack/callback', env.BACKEND_URL).href;
const dashboard = new URL('/dashboard', env.FRONTEND_URL).href;
const callbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
const slackInstall = z.object({
  ok: z.literal(true),
  team: z.object({ name: z.string().min(1) }),
  access_token: z.string().min(1),
  incoming_webhook: z.object({
    channel_id: z.string().min(1),
    url: z.url({ protocol: /^https$/, hostname: /^hooks\.slack\.com$/ }),
  }),
});

export const slackRouter = Router();
slackRouter.use(requireAuth);

slackRouter.get('/connect', (_request, response) => {
  const state = signToken(
    { sub: response.locals.userId, jti: randomUUID() },
    'slack-oauth',
    OAUTH_STATE_SECONDS,
  );
  setOAuthCookie(response, 'slack', state);
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook',
    redirect_uri: redirectUri,
    state,
  }).toString();
  response.redirect(url.href);
});

slackRouter.get('/callback', async (request, response) => {
  const userId = response.locals.userId;
  const cookie = consumeOAuthCookie(request, response, 'slack');
  const query = callbackQuery.safeParse(request.query);
  if (
    !query.success ||
    query.data.state !== cookie ||
    verifyToken(cookie, 'slack-oauth')?.sub !== userId
  ) {
    throw new HttpError(400, 'Invalid or expired Slack authorization');
  }

  let install;
  try {
    const result = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.SLACK_CLIENT_ID}:${env.SLACK_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: query.data.code,
        redirect_uri: redirectUri,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!result.ok) throw new Error('Slack token exchange failed');
    install = slackInstall.parse(await result.json());
  } catch {
    throw new HttpError(502, 'Slack authorization could not be completed');
  }

  const fields = {
    teamName: install.team.name,
    accessToken: install.access_token,
    channelId: install.incoming_webhook.channel_id,
    webhookUrl: install.incoming_webhook.url,
  };
  await prisma.slackConnection.upsert({
    where: { userId },
    update: fields,
    create: { userId, ...fields },
  });
  response.redirect(dashboard);
});

slackRouter.get('/status', async (_request, response) => {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId: response.locals.userId },
    select: { teamName: true, channelId: true },
  });
  response
    .set('Cache-Control', 'no-store')
    .json(
      connection ? { connected: true, ...connection } : { connected: false },
    );
});

slackRouter.post('/disconnect', async (_request, response) => {
  await prisma.slackConnection.deleteMany({
    where: { userId: response.locals.userId },
  });
  response.status(204).end();
});
