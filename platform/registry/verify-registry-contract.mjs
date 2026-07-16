import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const compose = read('compose.yaml');
const config = read('config.yml');

const checks = [
  ['registry is loopback-only', compose.includes('127.0.0.1:5000:5000')],
  ['debug metrics are loopback-only', compose.includes('127.0.0.1:5001:5001')],
  ['runtime filesystem is read-only', compose.includes('read_only: true')],
  ['Linux capabilities are dropped', compose.includes('cap_drop:') && compose.includes('- ALL')],
  ['privilege escalation is disabled', compose.includes('no-new-privileges:true')],
  ['registry data is externally bind-mounted', compose.includes('FIA_REGISTRY_DATA')],
  ['registry HTTP secret is mandatory', compose.includes('REGISTRY_HTTP_SECRET:?')],
  ['authentication is enabled', config.includes('htpasswd:')],
  ['manifest deletion is disabled', /delete:\s*\n\s*enabled:\s*false/.test(config)],
  ['storage health checks are enabled', config.includes('storagedriver:') && config.includes('threshold: 3')],
  ['Prometheus metrics are enabled', config.includes('prometheus:') && config.includes('path: /metrics')],
  ['default outbound traces are disabled', compose.includes('OTEL_TRACES_EXPORTER: none')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Artifact custody contract failed: ${failed} invariant(s) missing.`);
  process.exit(1);
}
console.log(`Artifact custody contract passed: ${checks.length} invariants.`);
