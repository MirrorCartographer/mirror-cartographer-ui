import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL_COMMAND = 'node operations/cloudflare-research/runCloudflareResearchTests.v1.mjs';
const CANONICAL_NPM_STEP = 'npm run test:cloudflare-research';

export const REQUIRED_TESTS = Object.freeze([
  'operations/cloudflare-research/publicationBoundary.v1.test.mjs',
  'operations/cloudflare-research/publicationEnforcement.v1.test.mjs',
  'operations/cloudflare-research/runCloudflareResearchTests.v1.test.mjs'
]);

export const REQUIRED_GATE_SCRIPTS = Object.freeze([
  'test:local-gate',
  'test:pages-preview'
]);

async function assertRequiredFiles() {
  for (const relativePath of REQUIRED_TESTS) {
    await access(path.join(root, relativePath));
  }
}

function commandSteps(command) {
  if (typeof command !== 'string') return [];
  return command.split('&&').map((step) => step.trim()).filter(Boolean);
}

export function validatePackageBindings(packageJson) {
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('package.json scripts must be an object');
  }

  if (scripts['test:cloudflare-research'] !== CANONICAL_COMMAND) {
    throw new Error('package.json must bind test:cloudflare-research to the canonical runner');
  }

  for (const scriptName of REQUIRED_GATE_SCRIPTS) {
    const steps = commandSteps(scripts[scriptName]);
    const matches = steps.filter((step) => step === CANONICAL_NPM_STEP).length;
    if (matches !== 1) {
      throw new Error(`${scriptName} must invoke ${CANONICAL_NPM_STEP} exactly once as a discrete fail-closed step`);
    }
  }

  return true;
}

async function assertPackageBinding() {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  validatePackageBindings(packageJson);
}

export async function runCloudflareResearchTests() {
  await assertRequiredFiles();
  await assertPackageBinding();

  const result = spawnSync(process.execPath, ['--test', ...REQUIRED_TESTS], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.error) {
    throw new Error(`Cloudflare research contract suite could not start: ${result.error.message}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Cloudflare research contract suite failed with exit code ${String(result.status)}`);
  }

  return { passed: true, requiredTests: [...REQUIRED_TESTS] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCloudflareResearchTests().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
