import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessWorkflowEnumerationPromotion } from './workflow-enumeration-promotion-gate.mjs';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key !== '--input' && key !== '--output') throw new Error(`unknown_argument:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${key.slice(2)}_path_missing`);
    values[key.slice(2)] = value;
    index += 1;
  }
  if (!values.input) throw new Error('input_path_missing');
  if (!values.output) throw new Error('output_path_missing');
  return values;
}

function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function runPromotionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  if (inputPath === outputPath) throw new Error('input_output_path_collision');
  const inputText = await readFile(inputPath, 'utf8');
  const input = JSON.parse(inputText);
  const assessment = assessWorkflowEnumerationPromotion(input);
  const artifact = {
    schema_version: 2,
    artifact_type: 'workflow_enumeration_promotion_assessment',
    generated_at: new Date().toISOString(),
    source: {
      media_type: 'application/json',
      byte_length: Buffer.byteLength(inputText, 'utf8'),
      sha256: sha256Utf8(inputText)
    },
    assessment
  };
  const artifactText = `${JSON.stringify(artifact, null, 2)}\n`;
  await writeFile(outputPath, artifactText, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({
    output: outputPath,
    promotable: assessment.promotable,
    reason: assessment.reason,
    source_sha256: artifact.source.sha256
  })}\n`);
  return artifact;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPromotionCli().catch((error) => {
    const code = error?.code === 'EEXIST' ? 'output_exists' : error?.message ?? 'unknown_error';
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = 1;
  });
}
