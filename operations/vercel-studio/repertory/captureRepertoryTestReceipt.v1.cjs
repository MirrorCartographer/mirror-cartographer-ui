'use strict';

const { createHash } = require('node:crypto');
const { mkdirSync, readdirSync, writeFileSync } = require('node:fs');
const { dirname, join, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createReceipt, writeReceiptNoOverwrite } = require('./repertoryTestReceipt.v1.cjs');

const RUNNER = 'operations/vercel-studio/repertory/runRepertoryTests.v1.mjs';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function discoverTests(repoRoot) {
  const directory = resolve(repoRoot, 'operations/vercel-studio/repertory');
  return readdirSync(directory)
    .filter((name) => name.endsWith('.test.cjs'))
    .sort()
    .map((name) => relative(repoRoot, join(directory, name)).split('\\').join('/'));
}

function writeTextNoOverwrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, { encoding: 'utf8', flag: 'wx' });
}

function capture({ repoRoot = process.cwd(), evidenceDirectory, clock = () => new Date(), spawn = spawnSync } = {}) {
  if (!evidenceDirectory) throw new Error('evidenceDirectory is required');
  const testFiles = discoverTests(repoRoot);
  if (testFiles.length === 0) throw new Error('no repertory tests discovered');

  const startedAt = clock().toISOString();
  const result = spawn(process.execPath, [resolve(repoRoot, RUNNER)], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const finishedAt = clock().toISOString();
  const stdout = result.stdout || '';
  const stderr = result.stderr || (result.error ? `${result.error.message}\n` : '');
  const exitStatus = Number.isInteger(result.status) ? result.status : 1;
  const stamp = startedAt.replace(/[:.]/g, '-');
  const base = resolve(repoRoot, evidenceDirectory, `V-001-repertory-tests-${stamp}`);
  const stdoutPath = `${base}.stdout.txt`;
  const stderrPath = `${base}.stderr.txt`;
  const receiptPath = `${base}.receipt.json`;

  writeTextNoOverwrite(stdoutPath, stdout);
  writeTextNoOverwrite(stderrPath, stderr);
  const receipt = createReceipt({
    node_version: process.version,
    started_at: startedAt,
    finished_at: finishedAt,
    exit_status: exitStatus,
    test_files: testFiles,
    stdout_sha256: sha256(stdout),
    stderr_sha256: sha256(stderr)
  });
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeReceiptNoOverwrite(receiptPath, receipt);
  return { receipt, paths: { stdout: stdoutPath, stderr: stderrPath, receipt: receiptPath } };
}

if (require.main === module) {
  const evidenceDirectory = process.argv[2] || 'operations/evidence';
  try {
    const output = capture({ evidenceDirectory });
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    process.exitCode = output.receipt.exit_status;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { RUNNER, sha256, discoverTests, writeTextNoOverwrite, capture };
