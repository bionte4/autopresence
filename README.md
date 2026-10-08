# Absensi Monitor

Aplikasi internal pemantauan kehadiran dan integritas laporan Excel. Milestone saat ini: **M2 — Data master**.

## Prasyarat

- Node.js 22+
- pnpm 9
- Docker Desktop

## Setup lokal

```bash
cp .env.example .env
docker compose up -d postgres mailhog
pnpm install
pnpm db:ensure-role
pnpm prisma migrate deploy
pnpm db:seed
pnpm dev
```

Postgres di Docker memakai host port **5436** supaya tidak bentrok dengan Postgres lokal di 5432.

Buka [http://localhost:3000/login](http://localhost:3000/login).

Aplikasi memakai user database `absensi_app` (bukan superuser). Migrasi membuat role itu dan mencabut `UPDATE`/`DELETE` pada `AuditLog`. `DIRECT_URL` hanya untuk migrasi.

Akun seed (password dari `SEED_PASSWORD` di `.env`, default `DevPassword123!`):

- `super.admin@local`
- `hr.admin@local`
- `manager@local`
- `auditor@local`
- `employee@local`

Lima kali gagal masuk mengunci akun selama 15 menit. Percobaan gagal juga dibatasi 10 kali per 15 menit per email.

## Docker penuh (app + worker)

```bash
docker compose up --build
```

Mailhog UI: [http://localhost:8025](http://localhost:8025).

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm worker` | Proses worker (placeholder M0) |
