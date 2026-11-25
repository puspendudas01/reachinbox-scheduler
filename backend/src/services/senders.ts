import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../db/prisma';

export async function provisionEtherealSenders() {
  await prisma.$transaction(
    async (tx) => {
      // Serialize provisioning if multiple workers start against an empty DB.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('reachinbox:ethereal-senders'))`;
      if (await tx.sender.count()) return;

      process.env.ETHEREAL_CACHE = 'no';
      const { default: nodemailer } = await import('nodemailer');
      const senders = [];
      for (let index = 0; index < env.ETHEREAL_SENDER_COUNT; index += 1) {
        const account = await nodemailer.createTestAccount();
        senders.push({
          email: account.user,
          smtpHost: account.smtp.host,
          smtpPort: account.smtp.port,
          user: account.user,
          pass: account.pass,
        });
      }
      await tx.sender.createMany({ data: senders });
      logger.info({ count: senders.length }, 'Provisioned Ethereal senders');
    },
    { timeout: 120_000 },
  );
}
