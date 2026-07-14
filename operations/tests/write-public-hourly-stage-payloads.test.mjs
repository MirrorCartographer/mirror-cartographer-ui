import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePublicHourlyStageArtifact } from '../tools/write-public-hourly-stage-payloads.mjs';

const schedulePath = fileURLToPath(new URL('../repertory/hourly-productions.json', import.meta.url));

async function tempOutput(name = 'hourly-stage-payloads.json') {
  const directory = await mkdtemp(join(tmpdir(), 'mirror-cartographer-repertory-'));
  return join(directory, name);
}

test('writes one retained digest-bound artifact with 24 ordered public payloads', async () => {
  const outputPath = await tempOutput();
  const result = await writePublicHourlyStageArtifact({
    schedulePath,
    outputPath,
    continuityRevision: 'commit:test-revision',
    date: '2026-07-14',
  });
  const artifact = JSON.parse(await readFile(outputPath, 'utf8'));

  assert.equal(artifact.schema_version, 1);
  assert.equal(artifact.artifact_type, 'public_hourly_stage_payloads');
  assert.equal(artifact.payload_count, 24);
  assert.equal(artifact.payloads.length, 24);
  assert.deepEqual(artifact.payloads.map((payload) => payload.resolved_hour), Array.from({ length: 24 }, (_, hour) => hour));
  assert.equal(new Set(artifact.payloads.map((payload) => payload.stage.id)).size, 24);
  assert.equal(new Set(artifact.payloads.map((payload) => payload.continuity.channel)).size, 1);
  assert.match(artifact.source_schedule_sha256, /^[a-f0-9]{64}$/);
  assert.match(artifact.payloads_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.artifactSha256, /^[a-f0-9]{64}$/);
});

test('is deterministic for identical schedule, date, and continuity revision', async () => {
  const firstPath = await tempOutput('first.json');
  const secondPath = await tempOutput('second.json');
  const first = await writePublicHourlyStageArtifact({ schedulePath, outputPath: firstPath, continuityRevision: 'same', date: '2026-07-14' });
  const second = await writePublicHourlyStageArtifact({ schedulePath, outputPath: secondPath, continuityRevision: 'same', date: '2026-07-14' });

  assert.equal(first.payloadsSha256, second.payloadsSha256);
  assert.equal(await readFile(firstPath, 'utf8'), await readFile(secondPath, 'utf8'));
});

test('fails closed and preserves an existing destination byte-for-byte', async () => {
  const outputPath = await tempOutput();
  const marker = 'existing retained evidence\n';
  await writeFile(outputPath, marker, 'utf8');

  await assert.rejects(
    writePublicHourlyStageArtifact({ schedulePath, outputPath, continuityRevision: 'test', date: '2026-07-14' }),
    /refusing to overwrite existing artifact/,
  );
  assert.equal(await readFile(outputPath, 'utf8'), marker);
});

test('rejects invalid continuity revision and representative date before writing', async () => {
  const outputPath = await tempOutput();
  await assert.rejects(writePublicHourlyStageArtifact({ schedulePath, outputPath, continuityRevision: '', date: '2026-07-14' }), /continuityRevision/);
  await assert.rejects(writePublicHourlyStageArtifact({ schedulePath, outputPath, continuityRevision: 'test', date: 'July 14' }), /YYYY-MM-DD/);
});
