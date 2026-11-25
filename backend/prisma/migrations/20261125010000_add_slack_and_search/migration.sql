ALTER TABLE "Email"
    ADD COLUMN "searchDirty" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "searchVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Email_searchDirty_id_idx" ON "Email"("searchDirty", "id");

CREATE TABLE "SlackConnection" (
    "userId" UUID NOT NULL,
    "teamName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
