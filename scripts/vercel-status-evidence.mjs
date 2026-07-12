#!/usr/bin/env node

import fs from 'node:fs/promises';
import process from 'node:process';
import { classifyVercelDeploymentStatus } from './vercel-deployment-status-classifier.mjs';

function parseArgs(argv) {
  const args = { input: null, output: null, expectedCommit: null };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const value = argv[index + 1];

    if (token === '--input') {
      args.input = value;
      index += 1;
    } else if (token === '--output') {
      args.output = value;
      index += 1;
    } else if (token === '--expected-commit') {
      args.expectedCommit = value;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${token}`);
    }
  }

  return args;
}

function assertCommit(value) {
  if (value == null || value === '') return null;
  const commit = String(value).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('Expected commit must be a 40-character lowercase hexadecimal SHA.');
  }
  return commit;
}

async function readInput(path) {
  if (path) return fs.readFile(path, 'utf8');
  if (process.stdin.isTTY) {
    throw new Error('Provide --input <path> or pipe a JSON status payload on stdin.');
  }

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function selectVercelStatus(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.statuses)
      ? payload.statuses
      : Array.isArray(payload?.result?.statuses)
        ? payload.result.statuses
        : [payload];

  return candidates.find((status) => {
    const context = String(status?.context ?? '');
    const targetUrl = String(status?.target_url ?? status?.targetUrl ?? '');
    return /vercel/i.test(context) || /vercel\.com/i.test(targetUrl);
  }) ?? null;
}

export function buildVercelStatusEvidence(payload, options = {}) {
  const observedStatus = selectVercelStatus(payload);
  const expectedCommit = assertCommit(options.expectedCommit);
  const classification = classifyVercelDeploymentStatus(observedStatus ?? {});

  return {
    schema_version: 1,
    evidence_type: 'vercel_deployment_status',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    expected_commit: expectedCommit,
    observed_status: observedStatus
      ? {
          context: String(observedStatus.context ?? ''),
          state: String(observedStatus.state ?? 'unknown').toLowerCase(),
          target_url: String(observedStatus.target_url ?? observedStatus.targetUrl ?? ''),
          description: String(observedStatus.description ?? ''),
        }
      : null,
    classification,
    claims: {
      deployment_verified: classification.deploymentVerified,
      source_regression_proven: classification.sourceRegressionProven,
      served_commit_identity_verified: false,
    },
    next_action: classification.nextAction,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('Usage: node scripts/vercel-status-evidence.mjs [--input status.json] [--output evidence.json] [--expected-commit <sha>]\n');
    return;
  }

  const raw = await readInput(args.input);
  const payload = JSON.parse(raw);
  const evidence = buildVercelStatusEvidence(payload, {
    expectedCommit: args.expectedCommit,
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;

  if (args.output) {
    await fs.writeFile(args.output, serialized, 'utf8');
  } else {
    process.stdout.write(serialized);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
