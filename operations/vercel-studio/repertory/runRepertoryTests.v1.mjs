import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const directory = dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(directory)
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => join(directory, name));

if (testFiles.length === 0) {
  console.error('No repertory tests were discovered; failing closed.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
