import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../..');

describe('Caddy configuration', () => {
  it('Caddyfile exists at project root', () => {
    expect(existsSync(resolve(ROOT, 'Caddyfile'))).toBe(true);
  });

  it('Caddyfile contains reverse proxy for app service', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('reverse_proxy app:3000');
  });

  it('Caddyfile contains reverse proxy for n8n service', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('reverse_proxy n8n:5678');
  });

  it('Caddyfile uses DOMAIN env var with localhost default', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('{$DOMAIN:localhost}');
  });

  it('Caddyfile configures n8n on subdomain', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('n8n.{$DOMAIN:localhost}');
  });

  it('docker-compose.yml includes caddy service', () => {
    const content = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    expect(content).toContain('caddy:');
    expect(content).toContain('image: caddy:2-alpine');
  });

  it('docker-compose.yml caddy service depends on app and n8n', () => {
    const content = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    // Extract caddy service block (between "caddy:" service definition and "volumes:" section)
    const caddyMatch = content.match(/^\s{2}caddy:\s*\n([\s\S]*?)(?=\n\s{2}\w|\nvolumes:)/m);
    expect(caddyMatch).not.toBeNull();
    const caddySection = caddyMatch![1];
    expect(caddySection).toContain('depends_on');
    expect(caddySection).toContain('- app');
    expect(caddySection).toContain('- n8n');
  });

  it('docker-compose.yml caddy exposes ports 80 and 443', () => {
    const content = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    const caddyMatch = content.match(/^\s{2}caddy:\s*\n([\s\S]*?)(?=\n\s{2}\w|\nvolumes:)/m);
    expect(caddyMatch).not.toBeNull();
    const caddySection = caddyMatch![1];
    expect(caddySection).toContain("'80:80'");
    expect(caddySection).toContain("'443:443'");
  });

  it('docker-compose.yml includes caddy_data and caddy_config volumes', () => {
    const content = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    expect(content).toContain('caddy_data:');
    expect(content).toContain('caddy_config:');
  });

  it('app service no longer exposes port 3000 directly', () => {
    const content = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf-8');
    const appSection = content.split('app:')[1].split(/^\s{2}\w/m)[0];
    // Should use 'expose' instead of 'ports' for the app service
    expect(appSection).toContain('expose');
    expect(appSection).not.toMatch(/ports:[\s\S]*?'3000:3000'/);
  });

  it('.env.example includes DOMAIN variable', () => {
    const content = readFileSync(resolve(ROOT, '.env.example'), 'utf-8');
    expect(content).toContain('DOMAIN=');
  });

  it('Caddyfile enforces a Content-Security-Policy at the proxy layer', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('Content-Security-Policy');
    // The high-impact directives must be present even if specific
    // sources change over time.
    expect(content).toMatch(/frame-ancestors\s+'none'/);
    expect(content).toMatch(/object-src\s+'none'/);
    expect(content).toMatch(/base-uri\s+'self'/);
  });

  it('Caddyfile sets Permissions-Policy + COOP/CORP defaults', () => {
    const content = readFileSync(resolve(ROOT, 'Caddyfile'), 'utf-8');
    expect(content).toContain('Permissions-Policy');
    expect(content).toContain('Cross-Origin-Opener-Policy same-origin');
    expect(content).toContain('Cross-Origin-Resource-Policy same-origin');
  });
});
