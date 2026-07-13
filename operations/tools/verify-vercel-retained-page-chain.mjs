import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateVercelWorkflowPageChain } from './validate-vercel-workflow-page-chain.mjs';

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fail(reason, details = {}) { return { verified: false, reason, ...details }; }

export async function verifyRetainedPageChain({ input_path, output_path }) {
  if (!input_path || !output_path) return fail('input_and_output_paths_required');
  let raw;
  try { raw = await readFile(input_path); } catch (error) { return fail('input_read_failed', { code: error.code ?? 'unknown' }); }
  let input;
  try { input = JSON.parse(raw.toString('utf8')); } catch { return fail('input_invalid_json'); }
  const validation = validateVercelWorkflowPageChain(input);
  const receipt = {
    schema_version: 1,
    artifact_type: 'vercel_retained_workflow_page_chain_receipt',
    created_at: new Date().toISOString(),
    input: { path: input_path, sha256: sha256(raw), byte_length: raw.length },
    repository: input.repository ?? null,
    commit_sha: input.commit_sha ?? null,
    per_page: input.per_page ?? 100,
    validation,
    limitations: [
      'This receipt validates retained page semantics only; it does not authenticate retrieval.',
      'This receipt does not prove deployment identity, browser audibility, or physical-device behavior.'
    ]
  };
  const encoded = `${JSON.stringify(receipt, null, 2)}\n`;
  try { await writeFile(output_path, encoded, { flag: 'wx' }); } catch (error) { return fail(error.code === 'EEXIST' ? 'output_exists' : 'output_write_failed', { code: error.code ?? 'unknown' }); }
  return { verified: validation.verified, reason: validation.verified ? 'retained_page_chain_receipt_written' : 'retained_page_chain_receipt_written_invalid', output_path, receipt };
}

async function main() {
  const [input_path, output_path] = process.argv.slice(2);
  const result = await verifyRetainedPageChain({ input_path, output_path });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.verified ? 0 : 1;
}
if (import.meta.url === `file://${process.argv[1]}`) main();
