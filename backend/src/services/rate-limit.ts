import { env } from '../config/env';
import { emailRedis } from '../queues/email-queue';

const HOUR_MS = 3_600_000;
const COUNTER_TTL_SECONDS = 7_200;

export function getUtcHourWindow() {
  const start = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const key = new Date(start).toISOString().slice(0, 13).replace(/\D/g, '');
  return { start, end: start + HOUR_MS, key };
}

// Select and reserve the least-used sender in one Redis operation.
const reserveLeastUsedSender = `
  local index = 1
  local minimum = tonumber(redis.call('GET', KEYS[1]) or '0')
  for i = 2, #KEYS do
    local used = tonumber(redis.call('GET', KEYS[i]) or '0')
    if used < minimum then
      index = i
      minimum = used
    end
  end

  local count = redis.call('INCR', KEYS[index])
  if count == 1 then
    redis.call('EXPIRE', KEYS[index], ARGV[2])
  end
  if count > tonumber(ARGV[1]) then
    redis.call('DECR', KEYS[index])
    return -index
  end
  return index
`;

export async function reserveSender(
  senderIds: string[],
  hourlyLimit: number,
  scheduledAt: Date,
) {
  const { start: hourStart, end: hourEnd, key: hour } = getUtcHourWindow();
  const limit = Math.min(hourlyLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);
  const reserved = Number(
    await emailRedis.eval(
      reserveLeastUsedSender,
      senderIds.length,
      ...senderIds.map((senderId) => `rl:${senderId}:${hour}`),
      limit,
      COUNTER_TTL_SECONDS,
    ),
  );
  const senderIndex = Math.abs(reserved) - 1;

  if (reserved > 0) return { senderIndex };

  // Compress a full hour of schedule times into the first 3.6 seconds.
  const position = Math.floor((scheduledAt.getTime() - hourStart) / 1_000);
  const offset = Math.max(0, Math.min(position, 3_599));
  return { senderIndex, retryAt: new Date(hourEnd + offset) };
}
