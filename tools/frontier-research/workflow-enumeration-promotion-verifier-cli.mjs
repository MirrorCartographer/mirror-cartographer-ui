import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessWorkflowEnumerationPromotion } from './workflow-enumeration-promotion-gate.mjs';
import { verifyPromotionArtifactBinding } from './workflow-enumeration-promotion-verifier-core.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== '--source' && key !== '--artifact') throw new Error(`unknown_argument:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key.slice(2)}_path_missing`);
    values[key.slice(2)] = value;
    index += 1;
  }
  if (!values.source) throw new Error('source_path_missing');
  if (!values.artifact) throw new Error('artifact_path_missing');
  return values;
}

export async function runVerifierCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const sourceText = await readFile(resolve(args.source), 'utf8');
  const source = JSON.parse(sourceText);
  const artifact = JSON.parse(await readFile(resolve(args.artifact), 'utf8'));
  const reassessed = assessWorkflowEnumerationPromotion(source);
  const result = verifyPromotionArtifactBinding({ sourceText, artifact, reassessed });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.verified) process.exitCode = 2;
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runVerifierCli().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error?.message ?? 'unknown_error' })}\n`);
    process.exitCode = 1;
  });
}
