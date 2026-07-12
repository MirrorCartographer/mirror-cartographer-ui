#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
const failures = [];

const guarded = scripts['deploy:vercel:guarded'];
if (typeof guarded !== 'string' || guarded.trim() === '') {
  failures.push('deploy:vercel:guarded script missing');
} else {
  if (!guarded.includes('tools/vercel-ops/deployment-invocation.mjs')) failures.push('guarded entrypoint does not invoke deployment admission wrapper');
  if (!guarded.includes('--state operations/CURRENT_STATE.json')) failures.push('guarded entrypoint does not bind canonical current state');
  if (!guarded.includes('--paths')) failures.push('guarded entrypoint does not require changed-path evidence');
  if (!guarded.includes('--exact-commit')) failures.push('guarded entrypoint does not expose exact-commit mode');
  if (!guarded.includes('-- npx vercel')) failures.push('guarded entrypoint does not pass Vercel as the child command');
}

for (const [name, command] of Object.entries(scripts)) {
  if (name === 'deploy:vercel:guarded') continue;
  if (/\b(?:npx\s+)?vercel(?:\s|$)/.test(command)) failures.push(`unguarded Vercel invocation found in npm script: ${name}`);
}

if (failures.length) {
  console.error(JSON.stringify({ schema_version: 1, valid: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schema_version: 1,
  valid: true,
  guarded_entrypoint: 'deploy:vercel:guarded',
  claim_boundary: 'This contract proves package-script routing only. It does not prove provider capacity, deployment execution, served commit identity, or audibility.'
}, null, 2));
