import type { RequestHandler } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { readCookie, SESSION_COOKIE, verifyToken } from '../services/session';
import { HttpError } from '../utils/http-error';

export const requireAuth: RequestHandler = async (request, response, next) => {
  const token = verifyToken(readCookie(request, SESSION_COOKIE), 'session');
  const userId = z.uuid().safeParse(token?.sub);
  if (!userId.success)
    throw new HttpError(401, 'Sign in with Google to continue');

  const user = await prisma.user.findUnique({
    where: { id: userId.data },
    select: { id: true, email: true, name: true, avatar: true },
  });
  if (!user) throw new HttpError(401, 'Sign in with Google to continue');

  response.locals.user = user;
  response.locals.userId = user.id;
  next();
};

const trustedOrigins = new Set([
  new URL(env.FRONTEND_URL).origin,
  new URL(env.BACKEND_URL).origin,
]);
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireTrustedOrigin: RequestHandler = (
  request,
  _response,
  next,
) => {
  const { origin } = request.headers;
  if (
    !safeMethods.has(request.method) &&
    origin &&
    !trustedOrigins.has(origin)
  ) {
    throw new HttpError(403, 'Untrusted request origin');
  }
  next();
};
