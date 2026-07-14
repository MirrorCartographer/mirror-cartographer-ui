import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compilePublicHourlyStagePayloads } from './public-hourly-stage-payloads.mjs';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function assertDestinationAbsent(path) {
  try {
    await access(path, fsConstants.F_OK);
    throw new Error(`refusing to overwrite existing artifact: ${path}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function writePublicHourlyStageArtifact({ schedulePath, outputPath, continuityRevision, date = '2026-07-14' }) {
  if (typeof continuityRevision !== 'string' || !continuityRevision.trim()) {
    throw new Error('continuityRevision is required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');

  const resolvedSchedulePath = resolve(schedulePath);
  const resolvedOutputPath = resolve(outputPath);
  await assertDestinationAbsent(resolvedOutputPath);

  const scheduleText = await readFile(resolvedSchedulePath, 'utf8');
  const schedule = JSON.parse(scheduleText);
  const continuityState = Object.freeze({ channel: schedule.continuity_channel, revision: continuityRevision.trim() });
  const [year, month, day] = date.split('-').map(Number);
  const hourInstants = Array.from({ length: 24 }, (_, hour) => new Date(Date.UTC(year, month - 1, day, hour + 4)));
  const payloads = compilePublicHourlyStagePayloads({ schedule, continuityState, hourInstants });

  const payloadCanonical = canonicalJson(payloads);
  const artifact = {
    schema_version: 1,
    artifact_type: 'public_hourly_stage_payloads',
    source_schedule: resolvedSchedulePath,
    source_schedule_sha256: sha256(scheduleText),
    continuity_channel: schedule.continuity_channel,
    continuity_revision: continuityState.revision,
    representative_date: date,
    time_zone: payloads[0].time_zone,
    payload_count: payloads.length,
    payloads_sha256: sha256(payloadCanonical),
    payloads,
  };
  const output = `${JSON.stringify(artifact, null, 2)}\n`;

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, output, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return Object.freeze({ outputPath: resolvedOutputPath, artifactSha256: sha256(output), payloadsSha256: artifact.payloads_sha256 });
}

async function main(argv) {
  const args = Object.fromEntries(argv.map((entry) => {
    const separator = entry.indexOf('=');
    if (!entry.startsWith('--') || separator < 3) throw new Error(`invalid argument: ${entry}`);
    return [entry.slice(2, separator), entry.slice(separator + 1)];
  }));
  const result = await writePublicHourlyStageArtifact({
    schedulePath: args.schedule,
    outputPath: args.output,
    continuityRevision: args['continuity-revision'],
    date: args.date,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
