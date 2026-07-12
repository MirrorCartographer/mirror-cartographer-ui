#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const scripts = pkg.scripts || {};
const failures = [];

const expected = {
  'deploy:vercel:sentinel': '--exact-commit false',
  'deploy:vercel:exact': '--exact-commit true'
};

for (const [name, exactFlag] of Object.entries(expected)) {
  const command = scripts[name];
  if (typeof command !== 'string' || command.trim() === '') {
    failures.push(`${name} script missing`);
    continue;
  }
  if (!command.includes('tools/vercel-ops/deployment-invocation.mjs')) failures.push(`${name} does not invoke deployment admission wrapper`);
  if (!command.includes('--state operations/CURRENT_STATE.json')) failures.push(`${name} does not bind canonical current state`);
  if (!command.includes('--paths operations/changed-paths.json')) failures.push(`${name} does not bind changed-path evidence`);
  if (!command.includes(exactFlag)) failures.push(`${name} has incorrect exact-commit mode`);
  if (!command.includes('-- npx vercel')) failures.push(`${name} does not pass Vercel as the child command`);
}

for (const [name, command] of Object.entries(scripts)) {
  if (Object.hasOwn(expected, name)) continue;
  if (/\b(?:npx\s+)?vercel(?:\s|$)/.test(command)) failures.push(`unguarded Vercel invocation found in npm script: ${name}`);
}

if (failures.length) {
  console.error(JSON.stringify({ schema_version: 1, valid: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schema_version: 1,
  valid: true,
  guarded_entrypoints: Object.keys(expected),
  claim_boundary: 'This contract proves package-script routing only. It does not prove provider capacity, deployment execution, served commit identity, or audibility.'
}, null, 2));
