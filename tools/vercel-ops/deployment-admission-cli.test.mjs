import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDeploymentAdmissionCli } from './deployment-admission-cli.mjs';

function fixture(state, paths) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-cli-'));
  fs.mkdirSync(path.join(dir, 'operations'));
  fs.writeFileSync(path.join(dir, 'operations/CURRENT_STATE.json'), JSON.stringify(state));
  fs.writeFileSync(path.join(dir, 'operations/changed-paths.json'), JSON.stringify({ changed_paths: paths }));
  return dir;
}
function sink() {
  let value = '';
  return { stream: { write(chunk) { value += chunk; } }, read() { return value; } };
}
const blocked = { active_delivery_item: 'V-001', delivery_state: 'in_progress_blocked', observed_blocker: 'Vercel account build-rate limit' };

test('admits operations-only sentinel with exit 0', () => {
  const out = sink(), err = sink();
  const code = runDeploymentAdmissionCli({ cwd: fixture(blocked, ['operations/evidence/x.json']), stdout: out.stream, stderr: err.stream });
  assert.equal(code, 0);
  assert.equal(JSON.parse(out.read()).decision, 'allow_operations_only_sentinel');
  assert.equal(err.read(), '');
});

test('denies application change with exit 3', () => {
  const out = sink(), err = sink();
  const code = runDeploymentAdmissionCli({ cwd: fixture(blocked, ['app/page.tsx']), stdout: out.stream, stderr: err.stream });
  assert.equal(code, 3);
  assert.equal(JSON.parse(out.read()).reason, 'capacity_blocked_application_affecting');
});

test('malformed input fails closed with exit 2', () => {
  const dir = fixture(blocked, []);
  fs.writeFileSync(path.join(dir, 'operations/changed-paths.json'), '{');
  const out = sink(), err = sink();
  const code = runDeploymentAdmissionCli({ cwd: dir, stdout: out.stream, stderr: err.stream });
  assert.equal(code, 2);
  assert.equal(JSON.parse(err.read()).reason, 'cli_input_error');
});

test('exact commit flag admits one app attempt when capacity available', () => {
  const ready = { ...blocked, delivery_state: 'in_progress', observed_blocker: '' };
  const out = sink(), err = sink();
  const code = runDeploymentAdmissionCli({ cwd: fixture(ready, ['app/page.tsx']), argv: ['--exact-commit', 'true'], stdout: out.stream, stderr: err.stream });
  assert.equal(code, 0);
  assert.equal(JSON.parse(out.read()).decision, 'allow_single_exact_commit_deployment');
});
