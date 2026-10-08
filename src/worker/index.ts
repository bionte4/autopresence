function main(): void {
  console.log("Absensi Monitor worker started (M0 placeholder; cron jobs land in M7).");
  setInterval(() => {
    // Keep the process alive so docker-compose health stays up.
  }, 60_000);
}

main();
