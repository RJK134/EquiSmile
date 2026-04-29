# dev-bootstrap

One-click developer bootstrap pack for a full local dev stack: Docker, n8n,
PostgreSQL, Redis, Mailpit, pgAdmin, and Next.js / Node projects using Prisma.

## What's in the box

| Service    | Image                  | Where                            |
|------------|------------------------|----------------------------------|
| PostgreSQL | `postgres:16`          | `localhost:5432`                 |
| Redis      | `redis:7-alpine`       | `localhost:6379`                 |
| Mailpit    | `axllent/mailpit`      | UI: <http://localhost:8025>      |
| pgAdmin    | `dpage/pgadmin4`       | <http://localhost:5050>          |
| n8n        | `n8nio/n8n`            | <http://localhost:5678>          |
| n8n DB     | `postgres:16`          | (internal-only)                  |

Timezone is pinned to **Europe/Zurich** across every container.

## Quick start

### macOS / Linux

```bash
./scripts/bootstrap.sh
```

### Windows

```powershell
./scripts/bootstrap.ps1
```

The bootstrap script will:

1. Copy `.env` and `.env.n8n` from the templates **only if they don't already
   exist** — it will never overwrite existing env files.
2. `docker compose up -d` the core stack (Postgres, Redis, Mailpit, pgAdmin).
3. Wait for the Postgres healthcheck to report `healthy`.
4. Scan **sibling directories** for any folder containing
   `prisma/schema.prisma` and run `npx prisma migrate deploy` in each.
5. `docker compose up -d` the n8n stack (n8n + its own dedicated Postgres).

## Layout

```
dev-bootstrap/
├── README.md
├── .gitignore
├── docker/
│   ├── docker-compose.core.yml   # Postgres, Redis, Mailpit, pgAdmin
│   └── docker-compose.n8n.yml    # n8n + dedicated Postgres
├── env-templates/
│   ├── .env.template             # App env (DB, Redis, JWT, SMTP, Azure, Moodle, n8n webhook)
│   └── .env.n8n.template         # n8n env (encryption key, basic auth, DB creds)
└── scripts/
    ├── bootstrap.sh
    ├── bootstrap.ps1
    ├── reset-db.sh               # Drop + recreate dev DB, re-run migrations
    └── nuke.sh                   # Stop + remove all volumes (must type 'nuke')
```

## Default dev credentials

Intentionally weak — **dev only**, never production.

| Field      | Value     |
|------------|-----------|
| DB user    | `devuser` |
| DB pass    | `devpass` |
| DB name    | `devdb`   |
| DB port    | `5432`    |
| pgAdmin    | `admin@dev.local` / `devpass` |
| n8n basic  | `admin` / `admin` (change in `.env.n8n`) |

## Sibling-project layout

Place this `dev-bootstrap` repo next to your other projects:

```
~/code/
├── dev-bootstrap/
├── my-next-app/    # contains prisma/schema.prisma
└── my-other-app/   # contains prisma/schema.prisma
```

The bootstrap script discovers any sibling folder with `prisma/schema.prisma`
and runs `npx prisma migrate deploy` inside it. Projects without a
`node_modules` directory are skipped — run `npm install` in them first.

## Scripts

| Script              | What it does                                                          |
|---------------------|-----------------------------------------------------------------------|
| `bootstrap.sh/.ps1` | Bring the full stack up and apply migrations                          |
| `reset-db.sh`       | Drop + recreate the dev DB, then re-run migrations (prompts `yes`)    |
| `nuke.sh`           | Stop all containers, remove all volumes (must type `nuke` to confirm) |

## Notes

- Uses `docker compose` v2 syntax (no hyphen).
- `.env` and `.env.n8n` are gitignored — **never commit them**.
- `N8N_ENCRYPTION_KEY` should be regenerated for every fresh install:
  `openssl rand -hex 32`.
- pgAdmin runs in desktop mode (no login screen) for local convenience.
