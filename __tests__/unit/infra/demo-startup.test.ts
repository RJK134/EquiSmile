import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

describe('Demo startup scripts', () => {
  describe('scripts/demo-start.sh', () => {
    const scriptPath = resolve(ROOT, 'scripts/demo-start.sh');

    it('exists', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('is executable', () => {
      const stat = statSync(scriptPath);
      // Check owner execute bit (0o100)
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    });

    it('has correct shebang', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    it('uses set -euo pipefail for safety', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('set -euo pipefail');
    });

    it('checks Docker is running', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('docker info');
    });

    it('creates .env with DEMO_MODE=true', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('DEMO_MODE=true');
    });

    it('runs docker compose up --build', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('docker compose up --build -d');
    });

    it('waits for migrator to complete', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('docker compose ps migrator');
    });

    it('checks app health endpoint', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('/api/health');
    });
  });

  describe('scripts/demo-start-local.sh', () => {
    const scriptPath = resolve(ROOT, 'scripts/demo-start-local.sh');

    it('exists', () => {
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('is executable', () => {
      const stat = statSync(scriptPath);
      expect(stat.mode & 0o111).toBeGreaterThan(0);
    });

    it('has correct shebang', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    });

    it('checks for node prerequisite', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('command -v node');
    });

    it('runs prisma migrate deploy', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('prisma migrate deploy');
    });

    it('seeds demo data', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('prisma/seed-demo.ts');
    });

    it('starts dev server with DEMO_MODE=true', () => {
      const content = readFileSync(scriptPath, 'utf-8');
      expect(content).toContain('DEMO_MODE=true');
      expect(content).toContain('npm run dev');
    });
  });
});

describe('Migrator service in docker-compose.yml', () => {
  const composePath = resolve(ROOT, 'docker-compose.yml');
  const content = readFileSync(composePath, 'utf-8');

  it('defines a migrator service', () => {
    expect(content).toContain('migrator:');
  });

  it('migrator builds with target: migrator', () => {
    const migratorSection = content.split('migrator:')[1].split(/^\s{2}\w/m)[0];
    expect(migratorSection).toContain('target: migrator');
  });

  it('migrator depends on postgres being healthy', () => {
    const migratorSection = content.split('migrator:')[1].split(/^\s{2}\w/m)[0];
    expect(migratorSection).toContain('depends_on');
    expect(migratorSection).toContain('service_healthy');
  });

  it('migrator uses restart: no', () => {
    const migratorSection = content.split('migrator:')[1].split(/^\s{2}\w/m)[0];
    expect(migratorSection).toContain('restart: "no"');
  });

  it('app depends on migrator with service_completed_successfully', () => {
    const appSection = content.split(/^\s{2}app:/m)[1].split(/^\s{2}\w/m)[0];
    expect(appSection).toContain('migrator:');
    expect(appSection).toContain('service_completed_successfully');
  });

  it('app healthcheck uses wget instead of curl', () => {
    const appSection = content.split(/^\s{2}app:/m)[1].split(/^\s{2}\w/m)[0];
    expect(appSection).toContain('wget');
    expect(appSection).not.toContain('curl');
  });
});

describe('Dockerfile migrator stage', () => {
  const dockerfilePath = resolve(ROOT, 'Dockerfile');
  const content = readFileSync(dockerfilePath, 'utf-8');

  it('defines a migrator stage', () => {
    expect(content).toContain('FROM base AS migrator');
  });

  it('migrator stage copies prisma directory', () => {
    // Find the migrator section
    const migratorSection = content.split('FROM base AS migrator')[1].split('FROM base AS runner')[0];
    expect(migratorSection).toContain('COPY prisma ./prisma');
  });

  it('migrator stage copies generated prisma client', () => {
    const migratorSection = content.split('FROM base AS migrator')[1].split('FROM base AS runner')[0];
    expect(migratorSection).toContain('node_modules/.prisma');
  });

  it('migrator stage runs prisma migrate deploy', () => {
    const migratorSection = content.split('FROM base AS migrator')[1].split('FROM base AS runner')[0];
    expect(migratorSection).toContain('prisma migrate deploy');
  });

  it('migrator stage conditionally seeds when DEMO_MODE=true', () => {
    const migratorSection = content.split('FROM base AS migrator')[1].split('FROM base AS runner')[0];
    expect(migratorSection).toContain('DEMO_MODE');
    expect(migratorSection).toContain('seed-demo.ts');
  });
});

describe('n8n database init script', () => {
  const initScriptPath = resolve(ROOT, 'docker/init-databases.sh');

  it('exists', () => {
    expect(existsSync(initScriptPath)).toBe(true);
  });

  it('is executable', () => {
    const stat = statSync(initScriptPath);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('creates n8n database', () => {
    const content = readFileSync(initScriptPath, 'utf-8');
    expect(content).toContain('CREATE DATABASE n8n');
  });

  it('grants privileges to postgres user', () => {
    const content = readFileSync(initScriptPath, 'utf-8');
    expect(content).toContain('GRANT ALL PRIVILEGES ON DATABASE n8n');
  });

  it('is mounted in docker-compose.yml', () => {
    const compose = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    expect(compose).toContain('init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh');
  });
});
