import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
const out = resolve(root, 'artifacts');

execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

const files = [];
function walk(directory) {
  for (const name of readdirSync(directory).sort()) {
    const full = resolve(directory, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else {
      const bytes = readFileSync(full);
      files.push({
        path: relative(dist, full).replaceAll('\\', '/'),
        bytes: stat.size,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
walk(dist);

const commit = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return process.env.GIT_COMMIT || 'unknown'; }
})();
const dirty = (() => {
  try { return execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0; }
  catch { return null; }
})();

const aggregate = createHash('sha256');
for (const file of files) aggregate.update(`${file.path}\0${file.sha256}\0${file.bytes}\n`);
const manifest = {
  schema: 'foundation-intelligence-artifact/v1',
  application: 'mirror-cartographer-ui',
  commit,
  dirty,
  createdAt: new Date().toISOString(),
  entrypoint: 'index.html',
  fileCount: files.length,
  aggregateSha256: aggregate.digest('hex'),
  files,
};
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(resolve(dist, '.well-known/fia-artifact.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`FIA artifact ${manifest.aggregateSha256} (${manifest.fileCount} files)`);
if (dirty === true && process.env.FIA_ALLOW_DIRTY !== '1') {
  console.error('Build produced from a dirty tree. Set FIA_ALLOW_DIRTY=1 only for local experiments.');
  process.exitCode = 2;
}
