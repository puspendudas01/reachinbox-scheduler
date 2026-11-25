import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { requireAuth } from '../middlewares/auth';
import {
  clearSession,
  consumeOAuthCookie,
  OAUTH_STATE_SECONDS,
  setOAuthCookie,
  setSession,
  signToken,
  verifyToken,
} from '../services/session';
import { HttpError } from '../utils/http-error';

const google = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  new URL('/api/auth/google/callback', env.BACKEND_URL).href,
);
const dashboard = new URL('/dashboard', env.FRONTEND_URL).href;
const callbackQuery = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
const googleProfile = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().min(1).optional(),
  picture: z.url({ protocol: /^https$/ }).optional(),
  nonce: z.string(),
});

export const authRouter = Router();

authRouter.get('/google', async (_request, response) => {
  const state = randomUUID();
  const { codeVerifier, codeChallenge } =
    await google.generateCodeVerifierAsync();
  if (!codeChallenge)
    throw new Error('Google PKCE challenge generation failed');
  const cookie = signToken(
    { state, codeVerifier },
    'google-oauth',
    OAUTH_STATE_SECONDS,
  );
  setOAuthCookie(response, 'google', cookie);

  const url = new URL(
    google.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    }),
  );
  url.searchParams.set('nonce', state);
  response.redirect(url.href);
});

authRouter.get('/google/callback', async (request, response) => {
  const cookie = consumeOAuthCookie(request, response, 'google');
  const saved = verifyToken(cookie, 'google-oauth');
  const input = callbackQuery.safeParse(request.query);
  if (
    !input.success ||
    saved?.state !== input.data.state ||
    typeof saved.codeVerifier !== 'string'
  ) {
    throw new HttpError(400, 'Invalid or expired Google sign-in');
  }

  let profile;
  try {
    const { tokens } = await google.getToken({
      code: input.data.code,
      codeVerifier: saved.codeVerifier,
    });
    if (!tokens.id_token) throw new Error('Missing ID token');
    const ticket = await google.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    profile = googleProfile.safeParse(ticket.getPayload());
  } catch {
    throw new HttpError(502, 'Google sign-in could not be completed');
  }
  if (!profile.success || profile.data.nonce !== input.data.state) {
    throw new HttpError(401, 'Google did not verify this profile');
  }

  const { sub: googleId, email, name, picture } = profile.data;
  const fields = { email, name: name ?? email, avatar: picture ?? null };
  const user = await prisma.user.upsert({
    where: { googleId },
    create: { googleId, ...fields },
    update: fields,
    select: { id: true },
  });
  setSession(response, user.id);
  response.redirect(dashboard);
});

authRouter.get('/me', requireAuth, (_request, response) => {
  response.set('Cache-Control', 'no-store').json(response.locals.user);
});

authRouter.post('/logout', (_request, response) => {
  clearSession(response);
  response.status(204).end();
});
