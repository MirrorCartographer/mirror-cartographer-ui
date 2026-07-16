import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { snapshot, verify, restore } from './recovery-capsule.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'foundation-recovery-'));
try {
  const src = path.join(root, 'source');
  const names = ['npm-vault', 'oci-registry', 'release-envelopes', 'build-evidence'];
  for (const name of names) {
    await mkdir(path.join(src, name), { recursive: true });
    await writeFile(path.join(src, name, 'fixture.bin'), `fixture:${name}\n`);
  }
  const cfg = { datasets: names.map(name => ({ name, path: path.join(src, name), class: name })) };
  const cfgPath = path.join(root, 'config.json');
  await writeFile(cfgPath, JSON.stringify(cfg));
  const capsule = path.join(root, 'capsule');
  await snapshot(cfgPath, capsule);
  await verify(capsule);
  await rm(src, { recursive: true, force: true });
  const restored = path.join(root, 'restored');
  await restore(capsule, restored);
  for (const name of names) {
    const got = await readFile(path.join(restored, name, 'fixture.bin'), 'utf8');
    if (got !== `fixture:${name}\n`) throw new Error(`behavior mismatch: ${name}`);
  }
  await writeFile(path.join(capsule, 'data', 'npm-vault', 'fixture.bin'), 'corrupt\n');
  let rejected = false;
  try { await verify(capsule); } catch { rejected = true; }
  if (!rejected) throw new Error('mutated backup was accepted');
  console.log('PASS destructive restore and corruption rejection');
} finally {
  await rm(root, { recursive: true, force: true });
}
