# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | How to start | Port | Notes |
|---------|-------------|------|-------|
| Next.js (dev) | `npm run dev` | 3000 | Main application |
| PostgreSQL 16 | `docker run -d --name equismile-postgres -e POSTGRES_USER=equismile -e POSTGRES_PASSWORD=equismile_dev_pw -e POSTGRES_DB=equismile -p 5433:5432 -v /workspace/docker/init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh postgres:16-alpine` | 5433 (host) → 5432 (container) | Required for all app functionality |
| n8n | Optional for dev | 5678 | Not needed when DEMO_MODE=true |

### Important notes

- **Docker cgroup v2 limitation**: The `docker-compose.yml` uses `deploy.resources.limits` which triggers cgroup errors in Cloud Agent VMs. Start PostgreSQL directly with `docker run` (no resource limits) instead of `docker compose up -d postgres`. The `docker compose` resource limits work only in standard environments with full cgroup v2 delegation.
- **DEMO_MODE=true**: When set in `.env`, all external integrations (WhatsApp, Google Maps, SMTP, Anthropic) return mock responses. The app is fully functional for development and testing without any API keys.
- **Demo login**: With DEMO_MODE=true, the sign-in page shows a "Continue as Demo Vet" button that bypasses GitHub OAuth. No OAuth credentials needed for local dev.
- **DATABASE_URL**: Must point to `localhost:5433` (not `postgres:5432`) when running the Next.js dev server on the host against the Docker postgres container.
- **Prisma migrations**: After pulling changes that modify `prisma/schema.prisma`, always run `npx prisma generate && npx prisma migrate dev`.
- **npm .npmrc**: The repo uses `legacy-peer-deps=true` in `.npmrc`.

### Standard commands

See `README.md` and `docs/SETUP.md` for the full command reference. Key commands:

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test` (Vitest, 1000+ tests)
- Prisma validate: `npx prisma validate`
- Dev server: `npm run dev`
- DB seed (demo data): `npm run db:seed-demo`

### Docker daemon startup (Cloud Agent VMs)

Docker requires manual daemon start in Cloud Agent VMs:

```bash
dockerd &>/tmp/dockerd.log &
sleep 5
```

The daemon config at `/etc/docker/daemon.json` must include:
```json
{
  "storage-driver": "fuse-overlayfs",
  "cgroup-parent": "/",
  "exec-opts": ["native.cgroupdriver=cgroupfs"]
}
```
