<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- PostgreSQL 16 is installed on the VM and listens on `127.0.0.1:5436`, matching `.env.example`. Superuser `absensi` / `absensi`, database `absensi`. This VM does not start Postgres via systemd; use `sudo pg_ctlcluster 16 main start`.
- The boot script copies `.env.example` to `.env` when `.env` is missing, then runs `pnpm db:ensure-role`, `pnpm prisma migrate deploy`, and `pnpm db:seed`. Seed accounts and `SEED_PASSWORD` are documented in `README.md`.
- Open `http://localhost:3000/login`. Next.js blocks dev requests from `127.0.0.1`, so signing in on that host does not finish.
- `pnpm typecheck` needs the route types from `pnpm exec next typegen` (also run by install), `pnpm dev`, or `pnpm build`.
- Mailhog is not running. SMTP still points at `localhost:1025`; a refused connection does not block login or ingest.
- The README Docker Compose path is for laptops. Cloud agents use the host Postgres above. The database saved with this environment already contains the seed data and one ingest of `fixtures/Laporan_Per_Atribut.xlsx`, so uploading that same file again is rejected as a duplicate.
