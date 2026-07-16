import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const out = join(root, 'artifacts');
const commit = process.env.FIA_COMMIT || safeExec('git', ['rev-parse', 'HEAD']) || 'uncommitted';

function safeExec(command, args) {
  try { return execFileSync(command, args, { encoding: 'utf8' }).trim(); } catch { return ''; }
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
mkdirSync(out, { recursive: true });
const files = walk(dist).map((path) => ({
  path: relative(dist, path).replaceAll('\\', '/'),
  bytes: statSync(path).size,
  sha256: digest(path),
})).sort((a, b) => a.path.localeCompare(b.path));
const aggregate = createHash('sha256').update(files.map((file) => `${file.sha256}  ${file.path}`).join('\n')).digest('hex');
const manifest = {
  schema: 'foundation-intelligence-artifact/v1',
  application: 'mirror-cartographer-ui',
  commit,
  created_at: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  file_count: files.length,
  aggregate_sha256: aggregate,
  files,
};
writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(out, 'SHA256SUMS'), `${files.map((file) => `${file.sha256}  ${file.path}`).join('\n')}\n`);
console.log(`FIA artifact ${aggregate} (${files.length} files)`);
