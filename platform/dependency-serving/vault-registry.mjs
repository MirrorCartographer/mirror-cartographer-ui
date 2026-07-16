#!/usr/bin/env node
import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const vaultDir = path.resolve(process.env.VAULT_DIR ?? process.argv[2] ?? 'platform/dependency-custody/vault');
const lockPath = path.resolve(process.env.LOCKFILE ?? process.argv[3] ?? 'package-lock.json');
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 4873);
const publicBase = (process.env.PUBLIC_BASE_URL ?? `http://${host}:${port}`).replace(/\/$/, '');

function digest(algorithm, bytes, encoding = 'hex') {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function json(res, status, body, extra = {}) {
  const bytes = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': bytes.length,
    'cache-control': 'no-store',
    ...extra
  });
  res.end(bytes);
}

function decodePackagePath(pathname) {
  const raw = decodeURIComponent(pathname.slice(1));
  if (!raw || raw.includes('..') || raw.includes('\\') || raw.includes('\0')) return null;
  if (raw.startsWith('@')) return raw.split('/').length === 2 ? raw : null;
  return raw.includes('/') ? null : raw;
}

function packageNameFromPath(packagePath, descriptor) {
  return descriptor.name ?? packagePath.replace(/^.*node_modules\//, '');
}

function standardTarballPath(name, version) {
  const base = name.startsWith('@') ? name.split('/')[1] : name;
  return `/${name}/-/${base}-${version}.tgz`;
}

async function loadState() {
  const [index, lock] = await Promise.all([
    readFile(path.join(vaultDir, 'index.json'), 'utf8').then(JSON.parse),
    readFile(lockPath, 'utf8').then(JSON.parse)
  ]);

  if (!Array.isArray(index.records) || typeof index.canonicalSha256 !== 'string') {
    throw new Error('invalid vault index');
  }
  if ((lock.lockfileVersion ?? 0) < 3) throw new Error('lockfileVersion 3 required');

  const lockDescriptors = new Map(Object.entries(lock.packages ?? {}));
  const packages = new Map();
  const tarballs = new Map();

  for (const record of index.records) {
    const descriptor = lockDescriptors.get(record.packagePath);
    if (!descriptor) throw new Error(`index record absent from lockfile: ${record.packagePath}`);

    const name = packageNameFromPath(record.packagePath, descriptor);
    if (name !== record.name || descriptor.version !== record.version || descriptor.integrity !== record.integrity) {
      throw new Error(`lock/index mismatch: ${record.packagePath}`);
    }

    const blob = path.resolve(vaultDir, record.blob);
    if (!blob.startsWith(`${vaultDir}${path.sep}`)) throw new Error(`blob escapes vault: ${record.blob}`);
    const info = await stat(blob);
    if (!info.isFile() || info.size !== record.size) throw new Error(`blob size mismatch: ${record.blob}`);

    const item = { ...record, descriptor, blob };
    const list = packages.get(name) ?? [];
    const conflict = list.find(
      (other) => other.version === item.version && JSON.stringify(other.descriptor) !== JSON.stringify(item.descriptor)
    );
    if (conflict) throw new Error(`conflicting metadata for ${name}@${item.version}`);
    if (!list.some((other) => other.version === item.version)) list.push(item);
    packages.set(name, list);
    tarballs.set(standardTarballPath(name, item.version), item);
  }

  for (const list of packages.values()) {
    list.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  }
  return { index, packages, tarballs };
}

const state = await loadState();

async function serveTarball(req, res, record) {
  const bytes = await readFile(record.blob);
  if (digest('sha512', bytes) !== record.sha512 || digest('sha256', bytes) !== record.sha256) {
    return json(res, 500, { error: 'vault_corruption' });
  }
  const sri = `sha512-${digest('sha512', bytes, 'base64')}`;
  if (sri !== record.integrity) return json(res, 500, { error: 'lockfile_integrity_failure' });

  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': bytes.length,
    'cache-control': 'public, max-age=31536000, immutable',
    etag: `"${record.sha512}"`
  });
  return req.method === 'HEAD' ? res.end() : res.end(bytes);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { allow: 'GET, HEAD' });
      return res.end();
    }

    const url = new URL(req.url, publicBase);
    if (url.pathname === '/-/health') {
      return json(res, 200, {
        ok: true,
        mode: 'vault-only',
        index: state.index.canonicalSha256,
        packages: state.packages.size
      });
    }

    const tarball = state.tarballs.get(decodeURIComponent(url.pathname));
    if (tarball) return serveTarball(req, res, tarball);

    const name = decodePackagePath(url.pathname);
    if (!name) return json(res, 404, { error: 'not_found' });
    const records = state.packages.get(name);
    if (!records) {
      return json(res, 404, {
        error: 'package_not_admitted',
        reason: 'upstream proxy and fallback are disabled'
      });
    }

    const versions = {};
    for (const record of records) {
      const descriptor = record.descriptor;
      versions[record.version] = {
        name,
        version: record.version,
        dependencies: descriptor.dependencies,
        optionalDependencies: descriptor.optionalDependencies,
        peerDependencies: descriptor.peerDependencies,
        peerDependenciesMeta: descriptor.peerDependenciesMeta,
        engines: descriptor.engines,
        os: descriptor.os,
        cpu: descriptor.cpu,
        bin: descriptor.bin,
        dist: {
          integrity: record.integrity,
          tarball: `${publicBase}${standardTarballPath(name, record.version)}`
        }
      };
    }

    return json(res, 200, {
      name,
      'dist-tags': { latest: records.at(-1).version },
      versions,
      _foundationVaultIndex: state.index.canonicalSha256
    });
  } catch (error) {
    return json(res, 500, { error: 'internal_error', message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`VAULT_REGISTRY ${publicBase} index=${state.index.canonicalSha256}`);
});
