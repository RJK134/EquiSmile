# EquiSmile Setup Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Docker and Docker Compose
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/RJK134/Equismile.git
cd Equismile
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
DATABASE_URL="postgresql://equismile:equismile@localhost:5432/equismile?schema=public"
```

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
npm run db:generate
npm run db:migrate
```

### 5a. Seed Test Data (Optional)

```bash
npm run db:seed
```

This creates sample customers, yards, horses, and visit requests. The seed is idempotent — running it multiple times will not duplicate data.

### 6. Start Development Server

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
| `npm run test` | Run tests |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database (idempotent) |
| `npm run db:studio` | Open Prisma Studio |

## Docker Services

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| PostgreSQL | 5432 | Database | `pg_isready` every 10s |
| n8n | 5678 | Workflow automation | Depends on healthy Postgres |

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start all services in background |
| `docker compose down` | Stop all services |
| `docker compose down -v` | Stop services and remove volumes |
| `docker compose ps` | Show service status |
| `docker compose logs -f postgres` | Follow PostgreSQL logs |
| `docker compose logs -f n8n` | Follow n8n logs |

## Project Structure

```
app/              # Next.js App Router pages
components/       # Shared React components
lib/              # Shared utilities
prisma/           # Database schema and migrations
messages/         # i18n translation files
i18n/             # next-intl configuration
n8n/              # Exported n8n workflows
docs/             # Documentation
.claude/          # Claude Code configuration
```

## Troubleshooting

### Database connection fails
Ensure Docker is running and the PostgreSQL container is healthy:
```bash
docker compose ps
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
