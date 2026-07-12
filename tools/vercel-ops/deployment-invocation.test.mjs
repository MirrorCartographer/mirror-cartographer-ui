import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDeploymentInvocation } from './deployment-invocation.mjs';

function fixture(state, changed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-invoke-'));
  fs.mkdirSync(path.join(dir, 'operations'));
  fs.writeFileSync(path.join(dir, 'operations/CURRENT_STATE.json'), JSON.stringify(state));
  fs.writeFileSync(path.join(dir, 'operations/changed-paths.json'), JSON.stringify({ changed_paths: changed }));
  return dir;
}

function stream() {
  let value = '';
  return { write(chunk) { value += chunk; }, read() { return value; } };
}

const blocked = { active_delivery_item: 'V-001', delivery_state: 'in_progress_blocked', observed_blocker: 'Vercel build-rate limit' };
const open = { active_delivery_item: 'V-001', delivery_state: 'in_progress', observed_blocker: '' };

test('denial prevents command execution', () => {
  const cwd = fixture(blocked, ['app/page.tsx']);
  let calls = 0;
  const code = runDeploymentInvocation({ cwd, argv: ['--state', 'operations/CURRENT_STATE.json', '--paths', 'operations/changed-paths.json', '--', 'vercel', '--prod'], stdout: stream(), stderr: stream(), spawn() { calls += 1; return { status: 0 }; } });
  assert.equal(code, 3);
  assert.equal(calls, 0);
});

test('admitted operations-only sentinel invokes exactly one command', () => {
  const cwd = fixture(blocked, ['operations/evidence/sentinel.json']);
  let seen;
  const code = runDeploymentInvocation({ cwd, argv: ['--', 'vercel', '--yes'], stdout: stream(), stderr: stream(), spawn(command, args, options) { seen = { command, args, options }; return { status: 0 }; } });
  assert.equal(code, 0);
  assert.equal(seen.command, 'vercel');
  assert.deepEqual(seen.args, ['--yes']);
  assert.equal(seen.options.shell, false);
});

test('exact commit application deployment runs only when capacity is available', () => {
  const cwd = fixture(open, ['app/page.tsx']);
  let calls = 0;
  const code = runDeploymentInvocation({ cwd, argv: ['--exact-commit', 'true', '--', 'vercel', '--prod'], stdout: stream(), stderr: stream(), spawn() { calls += 1; return { status: 7 }; } });
  assert.equal(code, 7);
  assert.equal(calls, 1);
});

test('missing command fails after admission without spawning', () => {
  const cwd = fixture(blocked, ['operations/sentinel.json']);
  let calls = 0;
  const code = runDeploymentInvocation({ cwd, argv: [], stdout: stream(), stderr: stream(), spawn() { calls += 1; return { status: 0 }; } });
  assert.equal(code, 2);
  assert.equal(calls, 0);
});

test('spawn errors fail closed', () => {
  const cwd = fixture(blocked, ['operations/sentinel.json']);
  const code = runDeploymentInvocation({ cwd, argv: ['--', 'vercel'], stdout: stream(), stderr: stream(), spawn() { return { error: new Error('missing binary'), status: null }; } });
  assert.equal(code, 2);
});
