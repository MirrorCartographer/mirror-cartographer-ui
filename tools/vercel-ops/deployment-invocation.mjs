#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateDeploymentAdmission } from './deployment-admission.mjs';

function parseArgs(argv) {
  const separator = argv.indexOf('--');
  const control = separator === -1 ? argv : argv.slice(0, separator);
  const command = separator === -1 ? [] : argv.slice(separator + 1);
  const args = new Map();
  for (let i = 0; i < control.length; i += 2) args.set(control[i], control[i + 1]);
  return { args, command };
}

export function runDeploymentInvocation({ argv = process.argv.slice(2), cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, spawn = spawnSync } = {}) {
  try {
    const { args, command } = parseArgs(argv);
    const statePath = path.resolve(cwd, args.get('--state') || 'operations/CURRENT_STATE.json');
    const pathsPath = path.resolve(cwd, args.get('--paths') || 'operations/changed-paths.json');
    const exactCommit = args.get('--exact-commit') === 'true';
    const currentState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const changedPayload = JSON.parse(fs.readFileSync(pathsPath, 'utf8'));
    const changedPaths = Array.isArray(changedPayload) ? changedPayload : changedPayload.changed_paths;
    const gate = evaluateDeploymentAdmission({ current_state: currentState, changed_paths: changedPaths, exact_commit_verification: exactCommit });
    stdout.write(`${JSON.stringify({ schema_version: 1, stage: 'admission', ...gate })}\n`);
    if (!gate.admitted) return 3;
    if (command.length === 0) {
      stderr.write(`${JSON.stringify({ schema_version: 1, stage: 'invocation', launched: false, reason: 'deployment_command_missing' })}\n`);
      return 2;
    }
    const child = spawn(command[0], command.slice(1), { cwd, stdio: 'inherit', shell: false });
    if (child.error) {
      stderr.write(`${JSON.stringify({ schema_version: 1, stage: 'invocation', launched: false, reason: 'spawn_error', error: child.error.message })}\n`);
      return 2;
    }
    const exitCode = Number.isInteger(child.status) ? child.status : 2;
    stdout.write(`${JSON.stringify({ schema_version: 1, stage: 'invocation', launched: true, command: command[0], exit_code: exitCode, admission_digest: gate.evidence_digest })}\n`);
    return exitCode;
  } catch (error) {
    stderr.write(`${JSON.stringify({ schema_version: 1, stage: 'invocation', launched: false, reason: 'input_error', error: error.message })}\n`);
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = runDeploymentInvocation();
