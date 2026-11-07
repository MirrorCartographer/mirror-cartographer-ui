#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';

const IGNORED_ENV = [
  'CI', 'GITHUB_ACTIONS', 'VERCEL', 'VERCEL_ENV', 'CF_PAGES', 'CF_PAGES_BRANCH',
  'SOURCE_DATE_EPOCH', 'BUILD_ID', 'BUILD_NUMBER', 'RANDOM', 'TMP', 'TEMP', 'TMPDIR'
];

function sha256(buffer) {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

function canonicalDigest(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

async function inventory(root) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).split(sep).join('/');
      if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${rel}`);
      if (entry.isDirectory()) await walk(full);
      if (entry.isFile()) {
        const bytes = await readFile(full);
        const metadata = await stat(full);
        out.push({ path: rel, size: bytes.length, mode: metadata.mode & 0o777, digest: sha256(bytes) });
      }
    }
  }
  await walk(root);
  return out;
}

function sanitizedEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of IGNORED_ENV) delete env[key];
  env.LANG = 'C';
  env.LC_ALL = 'C';
  env.TZ = 'UTC';
  env.SOURCE_DATE_EPOCH = extra.SOURCE_DATE_EPOCH ?? '0';
  return { ...env, ...extra };
}

async function run(command, cwd, env, logPath) {
  const [program, ...args] = command;
  return new Promise((resolveRun, reject) => {
    const child = spawn(program, args, { cwd, env, shell: false });
    const chunks = [];
    child.stdout.on('data', c => chunks.push(c));
    child.stderr.on('data', c => chunks.push(c));
    child.on('error', reject);
    child.on('close', async code => {
      const log = Buffer.concat(chunks);
      await writeFile(logPath, log);
      if (code !== 0) return reject(new Error(`build failed with exit code ${code}`));
      resolveRun({ code, logDigest: sha256(log) });
    });
  });
}

function compareInventories(a, b) {
  const left = new Map(a.map(x => [x.path, x]));
  const right = new Map(b.map(x => [x.path, x]));
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  const mismatches = [];
  for (const path of paths) {
    const first = left.get(path);
    const second = right.get(path);
    if (!first) mismatches.push({ path, type: 'only-second-run', second });
    else if (!second) mismatches.push({ path, type: 'only-first-run', first });
    else if (JSON.stringify(first) !== JSON.stringify(second)) {
      mismatches.push({ path, type: 'metadata-or-content', first, second });
    }
  }
  return mismatches;
}

export async function verifyReproducibility({ command, sourceDir, outputDir, sourceDateEpoch = '0' }) {
  const workspace = await mkdtemp(join(tmpdir(), 'fia-repro-'));
  const runs = [];
  try {
    for (let index = 1; index <= 2; index += 1) {
      const runRoot = join(workspace, `run-${index}`);
      await mkdir(runRoot, { recursive: true });
      const env = sanitizedEnv({
        SOURCE_DATE_EPOCH: sourceDateEpoch,
        FIA_BUILD_OUTPUT: resolve(sourceDir, outputDir),
        FIA_REPRO_RUN: String(index),
      });
      await rm(resolve(sourceDir, outputDir), { recursive: true, force: true });
      const execution = await run(command, sourceDir, env, join(runRoot, 'build.log'));
      const files = await inventory(resolve(sourceDir, outputDir));
      runs.push({ index, files, graphDigest: canonicalDigest(files), ...execution });
    }
    const equal = JSON.stringify(runs[0].files) === JSON.stringify(runs[1].files);
    const report = {
      schema: 'fia.reproducibility-report.v1',
      status: equal ? 'pass' : 'fail',
      command,
      outputDir,
      sourceDateEpoch,
      runs,
      mismatches: equal ? [] : compareInventories(runs[0].files, runs[1].files),
    };
    report.reportDigest = canonicalDigest(report);
    return report;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const separator = args.indexOf('--');
  if (separator < 0) throw new Error('usage: reproducibility-gate.mjs <source> <output> [--epoch=N] -- <command> [args...]');
  const options = args.slice(0, separator);
  const command = args.slice(separator + 1);
  const sourceDir = resolve(options[0]);
  const outputDir = options[1];
  const epochArg = options.find(v => v.startsWith('--epoch='));
  const report = await verifyReproducibility({ command, sourceDir, outputDir, sourceDateEpoch: epochArg?.split('=')[1] ?? '0' });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.status === 'pass' ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => { console.error(error.message); process.exit(2); });
}
