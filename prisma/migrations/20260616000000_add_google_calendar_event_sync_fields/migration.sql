ALTER TABLE "CoopEvent"
ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarHtmlLink" TEXT,
ADD COLUMN IF NOT EXISTS "googleMeetLink" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarSyncedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CoopEvent_googleCalendarEventId_idx" ON "CoopEvent"("googleCalendarEventId");
