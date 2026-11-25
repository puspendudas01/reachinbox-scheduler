import { randomUUID } from 'node:crypto';
import { env } from '../src/config/env';
import { SESSION_COOKIE } from '../src/services/session';

async function main() {
  const session = process.env.LOADTEST_SESSION_TOKEN;
  if (!session)
    throw new Error(
      'Set LOADTEST_SESSION_TOKEN to your signed session cookie value',
    );
  const runId = randomUUID().slice(0, 8);
  const response = await fetch(
    new URL('/api/campaigns/schedule', env.BACKEND_URL),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE}=${encodeURIComponent(session)}`,
      },
      body: JSON.stringify({
        subject: `Scheduler load test ${runId}`,
        body: 'Ethereal load test message.',
        emails: Array.from(
          { length: 1_000 },
          (_, index) => `load-${runId}-${index}@example.test`,
        ),
        startTime: new Date().toISOString(),
        delayMs: 0,
        hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      }),
    },
  );

  const result = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${result}`);
  console.log(result);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
