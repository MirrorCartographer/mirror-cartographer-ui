#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, rename, rm, copyFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const sha256 = b => createHash('sha256').update(b).digest('hex');

async function walk(root, rel = '') {
  const dir = path.join(root, rel);
  const names = (await readdir(dir)).sort();
  const out = [];
  for (const name of names) {
    const childRel = path.posix.join(rel.split(path.sep).join('/'), name);
    const abs = path.join(root, childRel);
    const st = await lstat(abs);
    if (st.isSymbolicLink()) throw new Error(`symlink rejected: ${childRel}`);
    if (st.isDirectory()) out.push(...await walk(root, childRel));
    else if (st.isFile()) {
      const bytes = await readFile(abs);
      out.push({ path: childRel, size: bytes.length, sha256: sha256(bytes), mode: st.mode & 0o777 });
    } else throw new Error(`special file rejected: ${childRel}`);
  }
  return out;
}

function rootDigest(entries) {
  return sha256(Buffer.from(entries.map(e => `${e.sha256}  ${e.size}  ${e.mode.toString(8)}  ${e.path}\n`).join('')));
}

async function copyTree(src, dst, entries) {
  for (const e of entries) {
    const target = path.join(dst, e.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(src, e.path), target);
  }
}

export async function snapshot(configPath, destination) {
  const cfg = JSON.parse(await readFile(configPath, 'utf8'));
  if (!Array.isArray(cfg.datasets) || cfg.datasets.length === 0) throw new Error('datasets required');
  const finalDir = path.resolve(destination);
  try { await access(finalDir); throw new Error(`destination exists: ${finalDir}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const temp = `${finalDir}.partial-${randomUUID()}`;
  await mkdir(temp, { recursive: true, mode: 0o700 });
  const datasets = [];
  try {
    for (const d of [...cfg.datasets].sort((a,b) => a.name.localeCompare(b.name))) {
      if (!/^[a-z0-9][a-z0-9._-]*$/.test(d.name)) throw new Error(`invalid dataset name: ${d.name}`);
      const source = path.resolve(d.path);
      const entries = await walk(source);
      await copyTree(source, path.join(temp, 'data', d.name), entries);
      datasets.push({ name: d.name, class: d.class ?? 'filesystem', consistency: d.consistency ?? 'quiesced', entries, rootSha256: rootDigest(entries) });
    }
    const manifest = { schema: 'foundation.recovery-capsule/v1', createdAt: new Date().toISOString(), datasets };
    const body = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(path.join(temp, 'manifest.json'), body, { mode: 0o600 });
    await writeFile(path.join(temp, 'manifest.sha256'), `${sha256(Buffer.from(body))}  manifest.json\n`, { mode: 0o600 });
    await rename(temp, finalDir);
    return manifest;
  } catch (e) { await rm(temp, { recursive: true, force: true }); throw e; }
}

export async function verify(capsule) {
  const root = path.resolve(capsule);
  const body = await readFile(path.join(root, 'manifest.json'));
  const expected = (await readFile(path.join(root, 'manifest.sha256'), 'utf8')).trim().split(/\s+/)[0];
  if (sha256(body) !== expected) throw new Error('manifest digest mismatch');
  const manifest = JSON.parse(body);
  if (manifest.schema !== 'foundation.recovery-capsule/v1') throw new Error('unsupported schema');
  for (const d of manifest.datasets) {
    const entries = await walk(path.join(root, 'data', d.name));
    if (JSON.stringify(entries) !== JSON.stringify(d.entries)) throw new Error(`inventory mismatch: ${d.name}`);
    if (rootDigest(entries) !== d.rootSha256) throw new Error(`root digest mismatch: ${d.name}`);
  }
  return manifest;
}

export async function restore(capsule, targetRoot) {
  const manifest = await verify(capsule);
  const target = path.resolve(targetRoot);
  await mkdir(target, { recursive: true });
  if ((await readdir(target)).length) throw new Error(`restore target not empty: ${target}`);
  for (const d of manifest.datasets) await copyTree(path.join(capsule, 'data', d.name), path.join(target, d.name), d.entries);
  for (const d of manifest.datasets) {
    const entries = await walk(path.join(target, d.name));
    if (rootDigest(entries) !== d.rootSha256) throw new Error(`restored root mismatch: ${d.name}`);
  }
  await writeFile(path.join(target, 'RESTORE_ACCEPTED.json'), `${JSON.stringify({ schema: manifest.schema, manifestSha256: sha256(await readFile(path.join(capsule, 'manifest.json'))), acceptedAt: new Date().toISOString() }, null, 2)}\n`);
  return manifest;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'snapshot' && args.length === 2) await snapshot(args[0], args[1]);
  else if (cmd === 'verify' && args.length === 1) await verify(args[0]);
  else if (cmd === 'restore' && args.length === 2) await restore(args[0], args[1]);
  else throw new Error('usage: recovery-capsule.mjs snapshot <config.json> <capsule> | verify <capsule> | restore <capsule> <empty-target>');
  console.log('PASS', cmd);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(`FAIL ${e.message}`); process.exit(1); });
