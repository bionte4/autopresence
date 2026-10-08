-- Role absensi_app is created first by scripts/ensure-app-role.ts.
-- PostgreSQL rejects CREATE ROLE inside Prisma's migration transaction.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO absensi_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO absensi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO absensi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO absensi_app;

ALTER DEFAULT PRIVILEGES FOR ROLE absensi IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO absensi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE absensi IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO absensi_app;

-- The application may append and read the hash chain, but must not rewrite it.
REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM absensi_app;
REVOKE UPDATE, DELETE ON TABLE "AuditLog" FROM PUBLIC;
