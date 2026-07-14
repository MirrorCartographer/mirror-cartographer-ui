#!/usr/bin/env node
import { constants } from 'node:fs';
import { open, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REQUIRED_ROLES } from './workflow-evidence-retention-manifest-core.mjs';
import { verifyWorkflowEvidenceChain } from './workflow-evidence-verification-chain-core.mjs';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments_must_be_flag_value_pairs');
    const name = key.slice(2);
    if (values.has(name)) throw new TypeError(`duplicate_argument:${name}`);
    values.set(name, value);
  }
  return values;
}

function requireRelativeContainedPath(baseDir, candidate, role) {
  if (typeof candidate !== 'string' || candidate.length === 0) throw new Error(`entry_path_invalid:${role}`);
  if (isAbsolute(candidate)) throw new Error(`entry_path_absolute_rejected:${role}`);
  const resolved = resolve(baseDir, candidate);
  const rel = relative(baseDir, resolved);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`entry_path_escape_rejected:${role}`);
  return resolved;
}

async function openRetainedFile(path, role) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new Error(`retained_artifact_symlink_rejected:${role}`);
    throw new Error(`retained_artifact_open_failed:${role}:${error.code || error.message}`);
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`retained_artifact_not_regular_file:${role}`);
    return handle;
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

export async function loadRetainedWorkflowEvidence({ manifestPath }) {
  const manifestText = await readFile(manifestPath, 'utf8').catch(error => {
    throw new Error(`manifest_read_failed:${error.code || error.message}`);
  });
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error('manifest_json_invalid');
  }

  const manifestRealPath = await realpath(manifestPath).catch(error => {
    throw new Error(`manifest_realpath_failed:${error.code || error.message}`);
  });
  const baseDir = dirname(manifestRealPath);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const byRole = new Map(entries.map(entry => [entry?.role, entry]));
  const retainedArtifacts = {};
  const opened = [];

  try {
    for (const role of REQUIRED_ROLES) {
      const entry = byRole.get(role);
      if (!entry) continue;
      const path = requireRelativeContainedPath(baseDir, entry.path, role);
      const handle = await openRetainedFile(path, role);
      opened.push(handle);
      retainedArtifacts[role] = await handle.readFile('utf8').catch(error => {
        throw new Error(`retained_artifact_read_failed:${role}:${error.code || error.message}`);
      });
    }
  } finally {
    await Promise.all(opened.map(handle => handle.close().catch(() => {})));
  }

  return { manifest, retainedArtifacts };
}

export async function verifyRetainedWorkflowEvidenceFromDisk({ manifestPath }) {
  const loaded = await loadRetainedWorkflowEvidence({ manifestPath });
  return verifyWorkflowEvidenceChain(loaded);
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  for (const key of ['manifest', 'output']) if (!args.get(key)) throw new Error(`missing_argument:${key}`);
  const result = await verifyRetainedWorkflowEvidenceFromDisk({ manifestPath: args.get('manifest') });
  await writeFile(args.get('output'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  if (result.verified !== true) process.exitCode = 2;
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
