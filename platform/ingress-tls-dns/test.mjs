#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const verifier = path.join(here, 'verify-ingress-contract.mjs');
const policy = JSON.parse(fs.readFileSync(path.join(here, 'policy.json'), 'utf8'));
const caddy = fs.readFileSync(path.join(here, 'Caddyfile'), 'utf8');

function run(name, mutatePolicy = p => p, mutateCaddy = c => c, expect = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fi-ingress-'));
  const p = structuredClone(policy);
  mutatePolicy(p);
  fs.writeFileSync(path.join(dir, 'policy.json'), JSON.stringify(p));
  fs.writeFileSync(path.join(dir, 'Caddyfile'), mutateCaddy(caddy));
  const result = spawnSync(process.execPath, [verifier, path.join(dir, 'policy.json'), path.join(dir, 'Caddyfile')], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  const ok = expect === 0 ? result.status === 0 : result.status !== 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exitCode = 1;
  }
}

run('baseline', p => p, c => c, 0);
run('reject public application bind', p => { p.public_ingress.application_bind = '0.0.0.0'; });
run('reject on-demand TLS', p => { p.tls.on_demand_tls = true; });
run('reject single CA', p => { p.tls.minimum_issuers = 1; });
run('reject single DNS authority', p => { p.dns.minimum_authoritative_providers = 1; });
run('reject registrar as zone authority', p => { p.dns.registrar_is_zone_authority = true; });
run('reject no external probe', p => { p.public_ingress.post_reload_ingress_probe_required = false; });
run('reject no key backup', p => { p.tls.independent_private_key_backup = false; });
run('reject public Caddy admin', p => p, c => c.replace('admin 127.0.0.1:2019', 'admin 0.0.0.0:2019'));
run('reject missing health containment', p => p, c => c.replace('health_fails 3', ''));

if (!process.exitCode) console.log('PASS adversarial ingress TLS DNS controls');
