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

function localParts(formatter, instant) {
  return Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

export function representativeHourInstants({ date, timeZone }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new Error('timeZone is required');

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) throw new Error('date must identify a real calendar day');

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA-u-hc-h23', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new Error(`invalid IANA time zone: ${timeZone}`);
  }

  const candidates = new Map(Array.from({ length: 24 }, (_, hour) => [hour, []]));
  const searchStart = Date.UTC(year, month - 1, day) - (18 * 60 * 60 * 1000);
  const searchEnd = Date.UTC(year, month - 1, day + 1) + (18 * 60 * 60 * 1000);

  for (let timestamp = searchStart; timestamp <= searchEnd; timestamp += 60 * 60 * 1000) {
    const instant = new Date(timestamp);
    const parts = localParts(formatter, instant);
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;
    if (localDate !== date) continue;
    candidates.get(Number(parts.hour))?.push(instant);
  }

  const nonBijective = [...candidates.entries()]
    .filter(([, instants]) => instants.length !== 1)
    .map(([hour, instants]) => `${String(hour).padStart(2, '0')}:00=${instants.length}`);
  if (nonBijective.length) {
    throw new Error(`representative date is not a 24-hour bijection in ${timeZone}: ${nonBijective.join(', ')}`);
  }

  return Object.freeze([...candidates.values()].map(([instant]) => instant));
}

export async function writePublicHourlyStageArtifact({ schedulePath, outputPath, continuityRevision, date = '2026-07-14' }) {
  if (typeof continuityRevision !== 'string' || !continuityRevision.trim()) {
    throw new Error('continuityRevision is required');
  }

  const resolvedSchedulePath = resolve(schedulePath);
  const resolvedOutputPath = resolve(outputPath);
  await assertDestinationAbsent(resolvedOutputPath);

  const scheduleText = await readFile(resolvedSchedulePath, 'utf8');
  const schedule = JSON.parse(scheduleText);
  const continuityState = Object.freeze({ channel: schedule.continuity_channel, revision: continuityRevision.trim() });
  const hourInstants = representativeHourInstants({ date, timeZone: schedule.time_zone });
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
    representative_hour_policy: 'exactly_one_instant_per_local_hour_fail_closed',
    time_zone: schedule.time_zone,
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
