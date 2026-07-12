#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { evaluateDeploymentAdmission } from './deployment-admission.mjs';

export function runDeploymentAdmissionCli({ argv = process.argv.slice(2), cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i], argv[i + 1]);
  const statePath = path.resolve(cwd, args.get('--state') || 'operations/CURRENT_STATE.json');
  const pathsPath = path.resolve(cwd, args.get('--paths') || 'operations/changed-paths.json');
  const exactCommit = args.get('--exact-commit') === 'true';
  try {
    const currentState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const changedPayload = JSON.parse(fs.readFileSync(pathsPath, 'utf8'));
    const changedPaths = Array.isArray(changedPayload) ? changedPayload : changedPayload.changed_paths;
    const result = evaluateDeploymentAdmission({ current_state: currentState, changed_paths: changedPaths, exact_commit_verification: exactCommit });
    stdout.write(`${JSON.stringify({ schema_version: 1, gate: 'deployment_admission', ...result })}\n`);
    return result.admitted ? 0 : 3;
  } catch (error) {
    stderr.write(`${JSON.stringify({ schema_version: 1, gate: 'deployment_admission', admitted: false, decision: 'deny', reason: 'cli_input_error', error: error.message })}\n`);
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = runDeploymentAdmissionCli();
