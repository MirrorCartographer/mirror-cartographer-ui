#!/usr/bin/env node
import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildRetainedWorkflowEvidence } from './retained-workflow-evidence-cli.mjs';
import { verifyVercelRetainedPlanBinding } from '../../operations/tools/verify-vercel-retained-plan-binding.mjs';

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new TypeError('arguments_must_be_flag_value_pairs');
    const name = key.slice(2);
    if (values.has(name)) throw new TypeError(`duplicate_argument:${name}`);
    values.set(name, value);
  }
  return values;
}

async function readRegularJson(path, label) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new Error(`${label}_symlink_rejected`);
    throw new Error(`${label}_open_failed:${error.code || error.message}`);
  }
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`${label}_not_regular_file`);
    const text = await handle.readFile('utf8');
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label}_json_invalid`);
    }
  } finally {
    await handle.close().catch(() => {});
  }
}

function requirePlanBinding(approvedPlan) {
  const algorithm = approvedPlan?.plan_binding?.algorithm;
  const digest = approvedPlan?.plan_binding?.digest;
  if (approvedPlan?.plan_binding_created !== true) throw new Error('approved_plan_not_bound');
  if (algorithm !== 'sha256') throw new Error('approved_plan_algorithm_not_sha256');
  if (!/^[a-f0-9]{64}$/.test(digest ?? '')) throw new Error('approved_plan_digest_invalid');
  return { algorithm, digest };
}

async function writePairNoOverwrite(entries) {
  const opened = [];
  try {
    for (const [path] of entries) opened.push([path, await open(path, 'wx')]);
    for (let index = 0; index < entries.length; index += 1) {
      const [, value] = entries[index];
      await opened[index][1].writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    }
  } catch (error) {
    await Promise.all(opened.map(([, handle]) => handle.close().catch(() => {})));
    await Promise.all(opened.map(([path]) => unlink(path).catch(() => {})));
    throw error;
  }
  await Promise.all(opened.map(([, handle]) => handle.close()));
}

export async function buildBoundRetainedEvidence({ approvedPlanPath, ...evidenceInputs }) {
  const approvedPlan = await readRegularJson(approvedPlanPath, 'approved_plan');
  const planBinding = requirePlanBinding(approvedPlan);
  const reconciliationBundle = await buildRetainedWorkflowEvidence(evidenceInputs);
  reconciliationBundle.plan_binding = planBinding;

  const retainedManifest = {
    schema_version: 1,
    evidence_class: 'vercel_retained_workflow_evidence_manifest',
    commit_sha: evidenceInputs.commitSha,
    generated_at: evidenceInputs.generatedAt,
    verified: reconciliationBundle.verified === true,
    promotion_candidate: reconciliationBundle.verified === true,
    plan_binding: planBinding,
    records: {
      reconciliation_bundle: 'retained_workflow_evidence_bundle'
    },
    claim_boundary: [
      'This manifest records a bound retained-evidence package only.',
      'It does not prove deployment identity, browser behavior, audio audibility, or physical-device acceptance.'
    ]
  };

  const bindingVerification = verifyVercelRetainedPlanBinding({ approvedPlan, retainedManifest, reconciliationBundle });
  if (bindingVerification.verified !== true) {
    throw new Error(`retained_plan_binding_rejected:${bindingVerification.reasons.join(',')}`);
  }
  retainedManifest.binding_verification = bindingVerification;
  reconciliationBundle.binding_verification = bindingVerification;
  return { retainedManifest, reconciliationBundle, bindingVerification };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const required = [
    'approved-plan', 'commit', 'primary', 'gh-pages', 'gh-command',
    'primary-retrieved-at', 'gh-retrieved-at', 'generated-at',
    'bundle-output', 'manifest-output'
  ];
  for (const key of required) if (!args.get(key)) throw new Error(`missing_argument:${key}`);
  if (args.get('bundle-output') === args.get('manifest-output')) throw new Error('output_paths_must_be_distinct');

  const result = await buildBoundRetainedEvidence({
    approvedPlanPath: args.get('approved-plan'),
    commitSha: args.get('commit'),
    primaryPath: args.get('primary'),
    ghPagesPath: args.get('gh-pages'),
    ghCommandPath: args.get('gh-command'),
    primaryRetrievedAt: args.get('primary-retrieved-at'),
    ghRetrievedAt: args.get('gh-retrieved-at'),
    generatedAt: args.get('generated-at')
  });

  await writePairNoOverwrite([
    [args.get('bundle-output'), result.reconciliationBundle],
    [args.get('manifest-output'), result.retainedManifest]
  ]);
  if (result.reconciliationBundle.verified !== true) process.exitCode = 2;
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
