import { config } from "dotenv";
import pg from "pg";

config({ path: ".env" });

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is required to create the application database role.");
}

const client = new pg.Client({ connectionString });

async function main(): Promise<void> {
  await client.connect();
  try {
    await client.query(
      "CREATE ROLE absensi_app LOGIN PASSWORD 'absensi_app' NOSUPERUSER NOCREATEDB NOCREATEROLE",
    );
    console.log("Created role absensi_app");
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "42710") throw error;
    console.log("Role absensi_app already exists");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
