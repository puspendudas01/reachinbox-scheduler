import './load-env';
import { z } from 'zod';

const integerString = z.string().regex(/^\d+$/).transform(Number);
const positiveInteger = integerString.pipe(z.int().positive());
const httpUrl = z.url({ protocol: /^https?$/ });
const requiredString = z.string().trim().min(1);

const envSchema = z.object({
  PORT: integerString.pipe(z.int().min(1).max(65535)),
  DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  ELASTICSEARCH_URL: httpUrl,
  WORKER_CONCURRENCY: positiveInteger,
  ETHEREAL_SENDER_COUNT: positiveInteger,
  MIN_DELAY_BETWEEN_EMAILS_MS: integerString.pipe(z.int().nonnegative()),
  MAX_EMAILS_PER_HOUR_PER_SENDER: positiveInteger,
  GOOGLE_CLIENT_ID: requiredString,
  GOOGLE_CLIENT_SECRET: requiredString,
  SLACK_CLIENT_ID: requiredString,
  SLACK_CLIENT_SECRET: requiredString,
  SESSION_SECRET: z.string().trim().min(32),
  FRONTEND_URL: httpUrl,
  BACKEND_URL: httpUrl,
  BULL_BOARD_USER: requiredString.refine((value) => !value.includes(':')),
  BULL_BOARD_PASS: requiredString,
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  const issues = result.error.issues.map(
    ({ path, message }) => `${path.join('.')}: ${message}`,
  );
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const env = result.data;
