import { spawnSync } from 'node:child_process';
import process from 'node:process';

const DEFAULT_SITE_URLS = [
  'https://mirror-cartographer-ui.vercel.app',
  'https://mirrorcartographer.github.io/mirror-cartographer-ui/',
];

const candidates = (process.env.SITE_URLS || process.env.SITE_URL || DEFAULT_SITE_URLS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const fail = (message) => {
  console.error(`Remote gate failed: ${message}`);
  process.exit(1);
};

const run = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: 'inherit',
  });

  return result.status ?? 1;
};

const runCapture = (command, args, env = {}) => spawnSync(command, args, {
  env: { ...process.env, ...env },
  encoding: 'utf8',
});

if (!candidates.length) {
  fail('no SITE_URL or SITE_URLS candidates supplied');
}

if (run(process.execPath, ['scripts/live-wiring-check.mjs']) !== 0) {
  fail('live wiring check did not pass');
}

if (run(process.execPath, ['scripts/preview-url-check.unit.mjs']) !== 0) {
  fail('preview URL unit harness did not pass');
}

let selectedUrl = '';
const errors = [];

for (const candidate of candidates) {
  const result = runCapture(process.execPath, ['scripts/preview-url-check.mjs'], {
    SITE_URLS: candidate,
  });

  if (result.status === 0) {
    selectedUrl = candidate;
    process.stdout.write(result.stdout);
    break;
  }

  errors.push(`${candidate}: ${(result.stderr || result.stdout || `exit ${result.status}`).trim()}`);
}

if (!selectedUrl) {
  fail(`no reachable preview candidate. ${errors.join(' | ')}`);
}

console.log(`Remote gate selected live URL: ${selectedUrl}`);

if (run('npm', ['run', 'test:live'], { SITE_URL: selectedUrl, SITE_URLS: candidates.join(',') }) !== 0) {
  fail(`live smoke failed against selected URL: ${selectedUrl}`);
}

console.log(`Remote gate passed against selected URL: ${selectedUrl}`);
