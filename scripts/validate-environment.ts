/**
 * Phase 8.3 — Environment validation script.
 *
 * Checks all required and optional services for UAT / production readiness.
 * Outputs a clear pass/fail report with latency information.
 *
 * Usage: npx tsx scripts/validate-environment.ts
 * npm script: npm run validate-env
 */

import { checkEnvironment } from '../lib/utils/env-check';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latencyMs?: number;
}

const results: CheckResult[] = [];

function icon(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'warn':
      return '⚠️ ';
    case 'fail':
      return '❌';
  }
}

async function checkDatabase(): Promise<void> {
  const start = Date.now();
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    const latency = Date.now() - start;
    results.push({
      name: 'Database',
      status: 'pass',
      message: `Connected (latency: ${latency}ms)`,
      latencyMs: latency,
    });
  } catch (err) {
    results.push({
      name: 'Database',
      status: 'fail',
      message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function checkEnvVars(): Promise<void> {
  const envResult = checkEnvironment();
  if (envResult.valid && envResult.warnings.length === 0) {
    results.push({
      name: 'Environment',
      status: 'pass',
      message: 'All required vars present',
    });
  } else if (envResult.valid) {
    results.push({
      name: 'Environment',
      status: 'pass',
      message: `Required vars present (${envResult.warnings.length} warning(s))`,
    });
  } else {
    results.push({
      name: 'Environment',
      status: 'fail',
      message: `Missing required vars: ${envResult.errors.join('; ')}`,
    });
  }
}

async function checkN8n(): Promise<void> {
  const n8nHost = process.env.N8N_HOST || 'localhost';
  const n8nPort = process.env.N8N_PORT || '5678';
  const n8nProtocol = process.env.N8N_PROTOCOL || 'http';
  const url = `${n8nProtocol}://${n8nHost}:${n8nPort}/healthz`;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    if (res.ok) {
      results.push({
        name: 'n8n',
        status: 'pass',
        message: `Reachable at ${n8nProtocol}://${n8nHost}:${n8nPort} (latency: ${latency}ms)`,
        latencyMs: latency,
      });
    } else {
      results.push({
        name: 'n8n',
        status: 'warn',
        message: `Responded with status ${res.status} at ${url}`,
      });
    }
  } catch {
    results.push({
      name: 'n8n',
      status: 'warn',
      message: `Not reachable at ${url} (optional for UAT)`,
    });
  }
}

async function checkWhatsApp(): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    results.push({
      name: 'WhatsApp',
      status: 'warn',
      message: 'Not configured (optional for UAT)',
    });
    return;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    const latency = Date.now() - start;
    if (res.ok) {
      results.push({
        name: 'WhatsApp',
        status: 'pass',
        message: `API credentials valid (latency: ${latency}ms)`,
        latencyMs: latency,
      });
    } else {
      results.push({
        name: 'WhatsApp',
        status: 'fail',
        message: `API returned status ${res.status} — check credentials`,
      });
    }
  } catch (err) {
    results.push({
      name: 'WhatsApp',
      status: 'fail',
      message: `API unreachable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function checkSmtp(): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER;

  if (!host || !user) {
    results.push({
      name: 'SMTP',
      status: 'warn',
      message: 'Not configured (optional for UAT)',
    });
    return;
  }

  const start = Date.now();
  try {
    const net = await import('net');
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection(
        { host, port: parseInt(port, 10), timeout: 5000 },
        () => {
          socket.destroy();
          resolve();
        },
      );
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timed out'));
      });
    });
    const latency = Date.now() - start;
    results.push({
      name: 'SMTP',
      status: 'pass',
      message: `Connected to ${host}:${port} (latency: ${latency}ms)`,
      latencyMs: latency,
    });
  } catch (err) {
    results.push({
      name: 'SMTP',
      status: 'fail',
      message: `Cannot connect to ${host}:${port}: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function checkGoogleMaps(): Promise<void> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    results.push({
      name: 'Google Maps',
      status: 'warn',
      message: 'Not configured (optional for UAT)',
    });
    return;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${apiKey}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const data = (await res.json()) as { status: string };
    if (data.status === 'OK') {
      results.push({
        name: 'Google Maps',
        status: 'pass',
        message: `API key valid (latency: ${latency}ms)`,
        latencyMs: latency,
      });
    } else if (data.status === 'REQUEST_DENIED') {
      results.push({
        name: 'Google Maps',
        status: 'fail',
        message: 'API key invalid or restricted',
      });
    } else {
      results.push({
        name: 'Google Maps',
        status: 'warn',
        message: `API returned status: ${data.status}`,
      });
    }
  } catch (err) {
    results.push({
      name: 'Google Maps',
      status: 'fail',
      message: `API unreachable: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   EquiSmile Environment Validation       ║');
  console.log('╚══════════════════════════════════════════╝\n');

  await checkEnvVars();
  await checkDatabase();
  await checkN8n();
  await checkWhatsApp();
  await checkSmtp();
  await checkGoogleMaps();

  console.log('');
  for (const r of results) {
    const latStr = r.latencyMs ? ` (latency: ${r.latencyMs}ms)` : '';
    console.log(`${icon(r.status)} ${r.name}: ${r.message}${r.latencyMs ? '' : ''}${latStr ? '' : ''}`);
  }

  const failures = results.filter((r) => r.status === 'fail');
  const warnings = results.filter((r) => r.status === 'warn');

  console.log('');
  if (failures.length === 0) {
    const warnMsg =
      warnings.length > 0
        ? ` (${warnings.length} optional service(s) not configured)`
        : '';
    console.log(`Result: READY FOR UAT${warnMsg}`);
  } else {
    console.log(
      `Result: NOT READY (${failures.length} failure(s), ${warnings.length} warning(s))`,
    );
    console.log('\nFix the following issues:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.message}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Environment validation failed unexpectedly:', err);
  process.exit(1);
});
