import cron from "node-cron";
import { checkDueSchedules, sendDailyDigest } from "@/modules/monitoring/service";
import { processDueDispatchJobs } from "@/modules/notify/dispatch";

function main(): void {
  console.log("Absensi Monitor worker started.");
  const dispatch = () => {
      void processDueDispatchJobs().catch(() => {
      console.error("Penutupan antrean lama gagal.");
    });
  };
  dispatch();
  setInterval(dispatch, 30_000);

  cron.schedule(
    "*/5 * * * *",
    () => {
      void checkDueSchedules(new Date()).catch(() => {
        console.error("Pemeriksaan jadwal upload gagal.");
      });
      void sendDailyDigest(new Date()).catch(() => {
        console.error("Ringkasan harian gagal.");
      });
    },
    { timezone: "Asia/Jakarta" },
  );

  cron.schedule(
    "0 7 * * *",
    () => {
      void sendDailyDigest(new Date()).catch(() => {
        console.error("Ringkasan harian gagal.");
      });
    },
    { timezone: "Asia/Jakarta" },
  );
}

main();
