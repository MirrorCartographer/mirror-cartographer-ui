import fs from 'node:fs';

const path = new URL('./platform-capabilities.yaml', import.meta.url);
const text = fs.readFileSync(path, 'utf8');

const requiredCapabilities = [
  'source-intake', 'reader-normalization', 'build-graph', 'deterministic-build',
  'dependency-control', 'artifact-custody', 'ci-workers', 'test-orchestration',
  'package-registry', 'image-registry', 'release-authority', 'hosting-runtime',
  'networking', 'reverse-proxy', 'tls', 'observability', 'object-storage',
  'databases', 'queues', 'backups', 'secrets', 'identity', 'deployment',
  'rollback', 'scaling', 'migration', 'disaster-recovery'
];

const forbiddenAuthorityRoles = [
  'intelligence', 'build-authority', 'release-authority',
  'canonical-artifact-store', 'sole-recovery-path'
];

const failures = [];

for (const capability of requiredCapabilities) {
  if (!text.includes(`- id: ${capability}`)) {
    failures.push(`missing capability: ${capability}`);
  }
}

for (const role of forbiddenAuthorityRoles) {
  if (!text.includes(`- ${role}`)) {
    failures.push(`missing forbidden external role: ${role}`);
  }
}

for (const authority of ['intelligence', 'build', 'release', 'artifacts', 'recovery']) {
  if (!text.includes(`  ${authority}: foundation`)) {
    failures.push(`foundation does not hold canonical authority: ${authority}`);
  }
}

if (!text.includes('mode: parallel')) {
  failures.push('program is not configured for parallel execution');
}

if (failures.length > 0) {
  console.error('FOUNDATION PLATFORM PROGRAM: REJECT');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FOUNDATION PLATFORM PROGRAM: ACCEPT');
console.log(`capabilities=${requiredCapabilities.length}`);
console.log(`forbidden_external_authority_roles=${forbiddenAuthorityRoles.length}`);
