# EquiSmile Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose v2+
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/RJK134/EquiSmile.git
cd EquiSmile
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your local settings. At minimum, set the database connection:

```
DATABASE_URL="postgresql://equismile:equismile_dev@localhost:5433/equismile?schema=public"
```

See `.env.example` for all available configuration options, including:
- **Database** — PostgreSQL connection and credentials
- **n8n** — Workflow automation service
- **WhatsApp** — Meta Cloud API credentials
- **SMTP** — Email sending configuration
- **Google Maps** — Geocoding and route optimisation
- **Home Base** — Starting location for route planning

### 4. Start Infrastructure

```bash
docker compose up -d
docker compose ps  # verify healthy
```

This starts:
- **PostgreSQL 16** on port 5432 (health-checked with `pg_isready`)
- **n8n** on port 5678 (waits for PostgreSQL to be healthy)

To stop all services:

```bash
docker compose down
```

To stop services and remove volumes (resets all data):

```bash
docker compose down -v
```

### 5. Set Up Database

```bash
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Apply migrations
```

### 5a. Seed Test Data (Optional)

```bash
npm run db:seed
```

Creates realistic test data: 5 customers (EN/FR), 8 yards, 15 horses, 10 enquiries, 5 visit requests, 1 route run, and 2 appointments. The seed is idempotent — running it multiple times will not duplicate data.

### 6. Validate Environment (Optional)

```bash
npm run validate-env
```

Checks database connectivity, n8n reachability, and optional service configurations. Outputs a clear pass/fail report.

### 7. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database (idempotent) |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run preflight` | Pre-deployment environment check |
| `npm run validate-env` | Full environment validation with service checks |

## Docker Services

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| PostgreSQL 16 | 5432 | Database | `pg_isready` every 10s |
| n8n | 5678 | Workflow automation | HTTP `/healthz` every 30s |

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start all services in background |
| `docker compose down` | Stop all services |
| `docker compose down -v` | Stop services and remove volumes |
| `docker compose ps` | Show service status |
| `docker compose logs -f postgres` | Follow PostgreSQL logs |
| `docker compose logs -f n8n` | Follow n8n logs |

## n8n Workflow Setup

After starting services, import the workflow templates from the `n8n/` directory:

1. Open n8n at [http://localhost:5678](http://localhost:5678)
2. Log in (default: admin / changeme)
3. Import each workflow JSON file
4. Configure credentials for WhatsApp, SMTP, Google Maps, and the EquiSmile API

## Project Structure

```
app/              # Next.js App Router pages and API routes
components/       # Shared React components (layout + UI)
lib/              # Services, repositories, utilities, validations
prisma/           # Database schema, migrations, seed
messages/         # i18n translation files (en.json, fr.json)
i18n/             # next-intl configuration
n8n/              # Exported n8n workflow JSON templates
scripts/          # Operational scripts
docs/             # Documentation
  uat/            # UAT test scripts
.github/          # CI/CD workflows
public/           # Static assets, PWA manifest
```

## Troubleshooting

### Database connection fails
Ensure Docker is running and the PostgreSQL container is healthy:
```bash
docker compose ps
docker compose logs postgres
```

### n8n not starting
Check that PostgreSQL is healthy first — n8n depends on it:
```bash
docker compose logs n8n
```

### Build errors after pulling
Run a clean install:
```bash
rm -rf node_modules
npm install
npm run db:generate
```

### Prisma schema out of sync
After pulling changes that modify `prisma/schema.prisma`:
```bash
npm run db:generate
npm run db:migrate
```

### Environment validation fails
```bash
npm run validate-env
```
Fix any reported issues. Required: `DATABASE_URL`. Optional services show warnings but do not block startup.
