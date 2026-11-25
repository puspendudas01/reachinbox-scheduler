import { Client, errors } from '@elastic/elasticsearch';
import type { EmailStatus } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/http-error';

const index = 'emails';
const batchSize = 250;
const retryDelayMs = 10_000;
const client = new Client({
  node: env.ELASTICSEARCH_URL,
  maxRetries: 0,
  requestTimeout: 3_000,
});

export const emailSearchChanged = {
  searchDirty: true,
  searchVersion: { increment: 1 },
} as const;

const selectEmail = {
  id: true,
  toEmail: true,
  subject: true,
  body: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  userId: true,
  searchVersion: true,
} as const;

interface EmailDocument {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  userId: string;
}

type SearchRow = Omit<EmailDocument, 'scheduledAt' | 'sentAt'> & {
  scheduledAt: Date;
  sentAt: Date | null;
  searchVersion: number;
};

async function ensureIndex() {
  if (await client.indices.exists({ index })) return;
  try {
    await client.indices.create({
      index,
      mappings: {
        dynamic: 'strict',
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          toEmail: { type: 'text' },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
        },
      },
    });
  } catch (error) {
    if (
      !(error instanceof errors.ResponseError) ||
      error.body?.error?.type !== 'resource_already_exists_exception'
    ) {
      throw error;
    }
  }
}

async function indexBatch(rows: SearchRow[]) {
  // Database versions keep late syncs from overwriting newer email states.
  const result = await client.bulk({
    refresh: 'wait_for',
    operations: rows.flatMap(
      ({ searchVersion, scheduledAt, sentAt, ...email }) => [
        {
          index: {
            _index: index,
            _id: email.id,
            version: searchVersion,
            version_type: 'external_gte' as const,
          },
        },
        {
          ...email,
          scheduledAt: scheduledAt.toISOString(),
          sentAt: sentAt?.toISOString() ?? null,
        },
      ],
    ),
  });

  const indexed = rows.filter((_row, position) => {
    const status = result.items[position]?.index?.status;
    return status !== undefined && (status < 300 || status === 409);
  });
  if (indexed.length) {
    await prisma.$transaction(
      indexed.map(({ id, searchVersion }) =>
        prisma.email.updateMany({
          where: { id, searchVersion, searchDirty: true },
          data: { searchDirty: false },
        }),
      ),
    );
  }
  if (indexed.length !== rows.length)
    throw new Error('Elasticsearch bulk indexing was incomplete');
}

async function flushPending() {
  let indexReady = false;
  while (!stopping) {
    const rows = await prisma.email.findMany({
      where: { searchDirty: true },
      select: selectEmail,
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (!rows.length) return;
    if (!indexReady) {
      await ensureIndex();
      indexReady = true;
    }
    await indexBatch(rows);
  }
}

let syncTask: Promise<void> | undefined;
let stopping = false;
let requested = false;
let retryTimer: NodeJS.Timeout | undefined;

export function requestEmailSearchSync() {
  if (stopping) return;
  requested = true;
  if (syncTask || retryTimer) return;
  syncTask = (async () => {
    while (requested && !stopping) {
      requested = false;
      await flushPending();
    }
  })()
    .catch((error: unknown) => {
      if (stopping) return;
      requested = true;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        requestEmailSearchSync();
      }, retryDelayMs).unref();
      logger.warn(
        { errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Email search sync deferred for retry',
      );
    })
    .finally(() => {
      syncTask = undefined;
      if (requested && !retryTimer) requestEmailSearchSync();
    });
}

export async function reindexEmails() {
  await ensureIndex();
  let cursor: string | undefined;
  let count = 0;
  for (;;) {
    const rows: SearchRow[] = await prisma.email.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      select: selectEmail,
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (!rows.length) return count;
    await indexBatch(rows);
    count += rows.length;
    cursor = rows.at(-1)?.id;
  }
}

export async function closeEmailSearch() {
  stopping = true;
  clearTimeout(retryTimer);
  await syncTask;
  await client.close();
}

export async function searchEmails(
  userId: string,
  query: string,
  status?: EmailStatus,
) {
  try {
    const result = await client.search<EmailDocument>({
      index,
      ignore_unavailable: true,
      allow_partial_search_results: false,
      size: 50,
      sort: ['_score', { scheduledAt: 'desc' }, { id: 'asc' }],
      query: {
        bool: {
          filter: [
            { term: { userId } },
            ...(status ? [{ term: { status } }] : []),
          ],
          ...(query && {
            must: {
              multi_match: {
                query,
                fields: ['toEmail^3', 'subject^2', 'body'],
              },
            },
          }),
        },
      },
    });
    return result.hits.hits.flatMap(({ _source }) =>
      _source ? [_source] : [],
    );
  } catch {
    throw new HttpError(503, 'Email search is temporarily unavailable');
  }
}
