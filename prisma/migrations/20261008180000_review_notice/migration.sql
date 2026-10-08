-- Notices for a correction or overtime step. Anomaly rows leave these columns empty.
ALTER TABLE "Notification" ADD COLUMN "correctionId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "requestId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "seat" "ReviewSeat";

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Notification_userId_correctionId_seat_channel_key" ON "Notification"("userId", "correctionId", "seat", "channel");
CREATE UNIQUE INDEX "Notification_userId_requestId_seat_channel_key" ON "Notification"("userId", "requestId", "seat", "channel");
