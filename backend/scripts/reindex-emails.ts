import { prisma } from '../src/db/prisma';
import { closeEmailSearch, reindexEmails } from '../src/services/email-search';

void reindexEmails()
  .then((count) => console.log(`Indexed ${count} emails`))
  .catch(() => {
    console.error(
      'Email reindex failed. Check PostgreSQL and Elasticsearch connectivity.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([closeEmailSearch(), prisma.$disconnect()]);
  });
