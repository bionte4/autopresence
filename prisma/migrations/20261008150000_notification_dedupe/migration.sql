-- One in-app or email notice per person per anomaly. A repeated dispatch hits this key and stops.
CREATE UNIQUE INDEX "Notification_userId_anomalyId_channel_key" ON "Notification"("userId", "anomalyId", "channel");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "Anomaly"("id") ON DELETE SET NULL ON UPDATE CASCADE;
