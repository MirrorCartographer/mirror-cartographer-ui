import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const REQUIRED_TESTS = Object.freeze([
  'operations/cloudflare-research/publicationBoundary.v1.test.mjs',
  'operations/cloudflare-research/publicationEnforcement.v1.test.mjs'
]);

async function assertRequiredFiles() {
  for (const relativePath of REQUIRED_TESTS) {
    await access(path.join(root, relativePath));
  }
}

async function assertPackageBinding() {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const command = packageJson?.scripts?.['test:cloudflare-research'];
  if (command !== 'node operations/cloudflare-research/runCloudflareResearchTests.v1.mjs') {
    throw new Error('package.json must bind test:cloudflare-research to the canonical runner');
  }
}

export async function runCloudflareResearchTests() {
  await assertRequiredFiles();
  await assertPackageBinding();

  const result = spawnSync(process.execPath, ['--test', ...REQUIRED_TESTS], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Cloudflare research contract suite failed with exit code ${result.status}`);
  }

  return { passed: true, requiredTests: [...REQUIRED_TESTS] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCloudflareResearchTests().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
