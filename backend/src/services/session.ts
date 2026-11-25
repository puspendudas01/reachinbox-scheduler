import { parse } from 'cookie';
import type { CookieOptions, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';

export const SESSION_COOKIE = 'reachinbox_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const OAUTH_STATE_SECONDS = 10 * 60;

type Audience = 'session' | 'google-oauth' | 'slack-oauth';
const issuer = 'reachinbox-scheduler';
const secure = new URL(env.BACKEND_URL).protocol === 'https:';
const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: secure ? 'none' : 'lax',
  path: '/api',
};

export function signToken(
  payload: JwtPayload,
  audience: Audience,
  seconds: number,
) {
  return jwt.sign(payload, env.SESSION_SECRET, {
    algorithm: 'HS256',
    issuer,
    audience,
    expiresIn: seconds,
  });
}

export function verifyToken(token: string | undefined, audience: Audience) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET, {
      algorithms: ['HS256'],
      issuer,
      audience,
    });
    return typeof payload === 'string' ? null : payload;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string) {
  return parse(request.headers.cookie ?? '')[name];
}

export function setSession(response: Response, userId: string) {
  response.cookie(
    SESSION_COOKIE,
    signToken({ sub: userId }, 'session', SESSION_SECONDS),
    {
      ...sessionCookieOptions,
      maxAge: SESSION_SECONDS * 1_000,
    },
  );
}

export function clearSession(response: Response) {
  response.clearCookie(SESSION_COOKIE, sessionCookieOptions);
}

const oauthCookies = {
  google: {
    name: 'reachinbox_google_oauth',
    path: '/api/auth/google/callback',
  },
  slack: { name: 'reachinbox_slack_oauth', path: '/api/slack/callback' },
};

function oauthCookieOptions(path: string): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path };
}

export function setOAuthCookie(
  response: Response,
  provider: keyof typeof oauthCookies,
  value: string,
) {
  const { name, path } = oauthCookies[provider];
  response.cookie(name, value, {
    ...oauthCookieOptions(path),
    maxAge: OAUTH_STATE_SECONDS * 1_000,
  });
}

export function consumeOAuthCookie(
  request: Request,
  response: Response,
  provider: keyof typeof oauthCookies,
) {
  const { name, path } = oauthCookies[provider];
  response.clearCookie(name, oauthCookieOptions(path));
  return readCookie(request, name);
}
