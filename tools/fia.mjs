#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [, , command, ...args] = process.argv;
if (command !== 'build') {
  console.error('Usage: node tools/fia.mjs build [--root DIR] [--input DIR] [--out DIR] [--source-date-epoch EPOCH] [--skip-compile] [--allow-unlocked]');
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(here, 'fia-build.mjs'), ...args], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
