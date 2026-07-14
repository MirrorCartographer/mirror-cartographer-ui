import test from 'node:test';
import assert from 'node:assert/strict';
import { link, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBoundAuthenticatedEvidenceManifest } from '../tools/write-bound-vercel-authenticated-evidence-manifest.mjs';

test('final manifest is derived from promoted bytes when the original path changes after promotion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bound-manifest-race-test-'));
  const inputPath = join(root, 'input.json');
  const outputPath = join(root, 'manifest.json');
  const promoted = {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    commit_sha: 'a'.repeat(40),
    nested: { state: 'promoted' }
  };
  const mutated = {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    commit_sha: 'b'.repeat(40),
    nested: { state: 'mutated-after-promotion' }
  };
  await writeFile(inputPath, `${JSON.stringify(promoted, null, 2)}\n`);

  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path: inputPath,
    output_path: outputPath,
    evidence_root: root,
    dependencies: {
      validate_promotion: async input => {
        assert.deepEqual(input, promoted);
        await writeFile(inputPath, `${JSON.stringify(mutated, null, 2)}\n`);
        return { verified: true, reason: 'synthetic_promotion_verified' };
      },
      write_manifest: async ({ input_path, output_path }) => {
        const observed = JSON.parse(await readFile(input_path, 'utf8'));
        await writeFile(output_path, `${JSON.stringify({ observed }, null, 2)}\n`, { flag: 'wx' });
        return { verified: true, reason: 'synthetic_manifest_written' };
      }
    }
  });

  const sourceAfterPromotion = JSON.parse(await readFile(inputPath, 'utf8'));
  const retainedManifest = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.equal(result.verified, true);
  assert.equal(result.reason, 'promoted_authenticated_evidence_manifest_written');
  assert.deepEqual(sourceAfterPromotion, mutated);
  assert.deepEqual(retainedManifest.observed, promoted);
  assert.match(result.bound_input_snapshot.sha256, /^[0-9a-f]{64}$/);
});

test('exclusive manifest creation rejects a pre-positioned symbolic-link output without altering its target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bound-manifest-symlink-test-'));
  const inputPath = join(root, 'input.json');
  const protectedPath = join(root, 'protected.json');
  const outputPath = join(root, 'manifest.json');
  const protectedBytes = '{"state":"must-remain-unchanged"}\n';

  await writeFile(inputPath, '{"synthetic":true}\n');
  await writeFile(protectedPath, protectedBytes);
  await symlink(protectedPath, outputPath);

  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path: inputPath,
    output_path: outputPath,
    evidence_root: root,
    dependencies: {
      validate_promotion: async () => ({ verified: true, reason: 'synthetic_promotion_verified' }),
      write_manifest: async ({ output_path }) => {
        try {
          await writeFile(output_path, '{"state":"should-not-write"}\n', { flag: 'wx' });
        } catch (error) {
          return {
            verified: false,
            reason: error.code === 'EEXIST' ? 'output_exists' : 'output_write_failed',
            code: error.code ?? 'unknown'
          };
        }
        return { verified: true, reason: 'synthetic_manifest_written' };
      }
    }
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, 'output_exists');
  assert.equal(result.code, 'EEXIST');
  assert.equal(await readFile(protectedPath, 'utf8'), protectedBytes);
});

test('exclusive manifest creation rejects a pre-positioned hard-link output without altering the shared inode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bound-manifest-hardlink-test-'));
  const inputPath = join(root, 'input.json');
  const protectedPath = join(root, 'protected.json');
  const outputPath = join(root, 'manifest.json');
  const protectedBytes = '{"state":"shared-inode-must-remain-unchanged"}\n';

  await writeFile(inputPath, '{"synthetic":true}\n');
  await writeFile(protectedPath, protectedBytes);
  await link(protectedPath, outputPath);

  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path: inputPath,
    output_path: outputPath,
    evidence_root: root,
    dependencies: {
      validate_promotion: async () => ({ verified: true, reason: 'synthetic_promotion_verified' }),
      write_manifest: async ({ output_path }) => {
        try {
          await writeFile(output_path, '{"state":"should-not-write"}\n', { flag: 'wx' });
        } catch (error) {
          return {
            verified: false,
            reason: error.code === 'EEXIST' ? 'output_exists' : 'output_write_failed',
            code: error.code ?? 'unknown'
          };
        }
        return { verified: true, reason: 'synthetic_manifest_written' };
      }
    }
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, 'output_exists');
  assert.equal(result.code, 'EEXIST');
  assert.equal(await readFile(protectedPath, 'utf8'), protectedBytes);
  assert.equal(await readFile(outputPath, 'utf8'), protectedBytes);
});

test('exclusive manifest creation rejects using the promoted input path as its own output without altering source bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bound-manifest-self-overwrite-test-'));
  const inputPath = join(root, 'promoted.json');
  const promotedBytes = '{"state":"promoted-source-must-remain-unchanged"}\n';

  await writeFile(inputPath, promotedBytes);

  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path: inputPath,
    output_path: inputPath,
    evidence_root: root,
    dependencies: {
      validate_promotion: async () => ({ verified: true, reason: 'synthetic_promotion_verified' }),
      write_manifest: async ({ output_path }) => {
        try {
          await writeFile(output_path, '{"state":"should-not-write"}\n', { flag: 'wx' });
        } catch (error) {
          return {
            verified: false,
            reason: error.code === 'EEXIST' ? 'output_exists' : 'output_write_failed',
            code: error.code ?? 'unknown'
          };
        }
        return { verified: true, reason: 'synthetic_manifest_written' };
      }
    }
  });

  assert.equal(result.verified, false);
  assert.equal(result.reason, 'output_exists');
  assert.equal(result.code, 'EEXIST');
  assert.equal(await readFile(inputPath, 'utf8'), promotedBytes);
});

test('production dependencies remain optional and invalid paths still fail closed', async () => {
  const result = await writeBoundAuthenticatedEvidenceManifest({
    input_path: '',
    output_path: ''
  });
  assert.deepEqual(result, {
    verified: false,
    reason: 'input_and_output_paths_required'
  });
});
