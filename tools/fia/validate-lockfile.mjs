#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export class LockfileValidationError extends Error {
  constructor(issues) {
    super(`Lockfile validation failed with ${issues.length} issue(s)`);
    this.name = 'LockfileValidationError';
    this.issues = issues;
  }
}

const MUTABLE_PROTOCOLS = /^(git\+|git:|github:|gitlab:|bitbucket:|http:)/i;
const REGISTRY_HTTPS = /^https:\/\/registry\.npmjs\.org\//i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function validateLockfileObject(lock, options = {}) {
  const { allowHosts = ['registry.npmjs.org'], requireRegistryHttps = true } = options;
  const issues = [];
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) {
    throw new LockfileValidationError([{ code: 'INVALID_JSON_ROOT', path: '$', message: 'Lockfile root must be an object' }]);
  }
  if (![2, 3].includes(lock.lockfileVersion)) {
    issues.push({ code: 'UNSUPPORTED_LOCKFILE_VERSION', path: '$.lockfileVersion', message: 'Only npm lockfileVersion 2 or 3 is accepted' });
  }
  if (!lock.packages || typeof lock.packages !== 'object' || Array.isArray(lock.packages)) {
    issues.push({ code: 'MISSING_PACKAGES_GRAPH', path: '$.packages', message: 'Lockfile must contain a packages graph' });
  }

  const packages = lock.packages && typeof lock.packages === 'object' ? lock.packages : {};
  for (const [pkgPath, pkg] of Object.entries(packages).sort(([a], [b]) => a.localeCompare(b))) {
    if (!pkg || typeof pkg !== 'object') continue;
    const at = `$.packages[${JSON.stringify(pkgPath)}]`;
    if (pkgPath === '') continue;
    if (!pkg.version || typeof pkg.version !== 'string') {
      issues.push({ code: 'MISSING_VERSION', path: `${at}.version`, message: 'Dependency must have an exact resolved version' });
    }
    if (!pkg.resolved || typeof pkg.resolved !== 'string') {
      issues.push({ code: 'MISSING_RESOLVED', path: `${at}.resolved`, message: 'Dependency must have a resolved source' });
    } else {
      if (MUTABLE_PROTOCOLS.test(pkg.resolved)) {
        issues.push({ code: 'MUTABLE_SOURCE', path: `${at}.resolved`, message: `Mutable or insecure source is forbidden: ${pkg.resolved}` });
      }
      try {
        const url = new URL(pkg.resolved);
        if (requireRegistryHttps && url.protocol !== 'https:') {
          issues.push({ code: 'INSECURE_SOURCE', path: `${at}.resolved`, message: 'Resolved dependency source must use HTTPS' });
        }
        if (!allowHosts.includes(url.hostname)) {
          issues.push({ code: 'UNAPPROVED_HOST', path: `${at}.resolved`, message: `Resolved host is not approved: ${url.hostname}` });
        }
        if (requireRegistryHttps && url.hostname === 'registry.npmjs.org' && !REGISTRY_HTTPS.test(pkg.resolved)) {
          issues.push({ code: 'NONCANONICAL_REGISTRY_URL', path: `${at}.resolved`, message: 'npm registry URLs must use the canonical HTTPS origin' });
        }
      } catch {
        issues.push({ code: 'INVALID_RESOLVED_URL', path: `${at}.resolved`, message: 'Resolved source must be an absolute URL' });
      }
    }
    if (!pkg.integrity || typeof pkg.integrity !== 'string') {
      issues.push({ code: 'MISSING_INTEGRITY', path: `${at}.integrity`, message: 'Dependency must include Subresource Integrity metadata' });
    } else if (!/^sha(256|384|512)-[A-Za-z0-9+/]+={0,2}(\s+sha(256|384|512)-[A-Za-z0-9+/]+={0,2})*$/.test(pkg.integrity)) {
      issues.push({ code: 'INVALID_INTEGRITY', path: `${at}.integrity`, message: 'Integrity must contain valid sha256/384/512 SRI tokens' });
    }
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      if (!pkg[field]) continue;
      for (const [name, spec] of Object.entries(pkg[field])) {
        if (typeof spec === 'string' && MUTABLE_PROTOCOLS.test(spec)) {
          issues.push({ code: 'MUTABLE_DEPENDENCY_SPEC', path: `${at}.${field}.${name}`, message: `Mutable dependency specification is forbidden: ${spec}` });
        }
      }
    }
  }

  const report = {
    schema: 'fia.lockfile-validation.v1',
    valid: issues.length === 0,
    lockfileVersion: lock.lockfileVersion ?? null,
    packageCount: Math.max(0, Object.keys(packages).length - (Object.hasOwn(packages, '') ? 1 : 0)),
    lockfileSha256: sha256(canonical(lock)),
    policySha256: sha256(canonical({ allowHosts: [...allowHosts].sort(), requireRegistryHttps })),
    issues: issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)),
  };
  if (issues.length) throw Object.assign(new LockfileValidationError(issues), { report });
  return report;
}

export async function validateLockfile(path, options) {
  const raw = await readFile(path, 'utf8');
  let lock;
  try { lock = JSON.parse(raw); }
  catch (error) { throw new LockfileValidationError([{ code: 'INVALID_JSON', path: '$', message: error.message }]); }
  return validateLockfileObject(lock, options);
}

async function main() {
  const args = process.argv.slice(2);
  const path = args[0];
  if (!path || args.includes('--help')) {
    console.log('Usage: node tools/fia/validate-lockfile.mjs <package-lock.json> [--allow-host host]');
    process.exit(path ? 0 : 2);
  }
  const allowHosts = ['registry.npmjs.org'];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--allow-host' && args[i + 1]) allowHosts.push(args[++i]);
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  try {
    const report = await validateLockfile(path, { allowHosts: [...new Set(allowHosts)] });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    if (error instanceof LockfileValidationError) {
      console.error(JSON.stringify(error.report ?? { schema: 'fia.lockfile-validation.v1', valid: false, issues: error.issues }, null, 2));
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
