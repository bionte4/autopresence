import path from "node:path";
import { expect, test } from "@playwright/test";

test("login, upload the sample report, and open an anomaly", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("hr.admin@local");
  await page.getByLabel("Kata sandi").fill("DevPassword123!");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/beranda/);

  await page.goto("/uploads");
  await page.locator("input[name=file]").setInputFiles(path.join(process.cwd(), "fixtures/Laporan_Per_Atribut.xlsx"));
  await page.locator("select[name=granularity]").selectOption("MONTHLY");
  await page.getByRole("button", { name: "Unggah" }).click();
  const stored = page.getByRole("heading", { name: "Detail upload" });
  const duplicate = page.getByRole("alert");
  await expect(stored.or(duplicate)).toBeVisible({ timeout: 30_000 });

  await page.goto("/anomalies");
  await expect(page.getByRole("heading", { name: "Anomali" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Detail" }).first()).toBeVisible();
});
