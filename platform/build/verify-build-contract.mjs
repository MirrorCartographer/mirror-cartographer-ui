#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const dockerfile = readFileSync(new URL('./Dockerfile.reproducible', import.meta.url), 'utf8');
const harness = readFileSync(new URL('./build-reproducible.sh', import.meta.url), 'utf8');
const failures = [];
const passes = [];

function check(name, condition, detail) {
  if (condition) passes.push(name);
  else failures.push(`${name}: ${detail}`);
}

check('base image is caller-supplied', /ARG NODE_IMAGE[\s\S]*FROM \$\{NODE_IMAGE\}/.test(dockerfile), 'Dockerfile must not choose a mutable default');
check('lockfile is mandatory', /COPY package\.json package-lock\.json/.test(dockerfile) && /package-lock\.json is mandatory/.test(harness), 'dependency graph must fail closed without package-lock.json');
check('npm clean install is used', /npm ci/.test(dockerfile), 'npm install may rewrite resolution');
check('dependency lifecycle scripts are disabled', /npm ci --ignore-scripts/.test(dockerfile), 'install scripts execute third-party code during intake');
check('strict peer dependency resolution is enabled', /--strict-peer-deps/.test(dockerfile), 'implicit peer resolution must fail closed');
check('compilation has no network', /RUN --network=none npm run build/.test(dockerfile), 'build stage may download undeclared inputs');
check('source timestamp is explicit', /SOURCE_DATE_EPOCH/.test(dockerfile) && /git show -s --format=%ct/.test(harness), 'timestamps can make output vary');
check('source identity is explicit', /SOURCE_COMMIT/.test(dockerfile) && /git rev-parse HEAD/.test(harness), 'artifact must bind to a complete source commit');
check('base image must be digest pinned', /@sha256:/.test(harness), 'mutable image tags are not admissible');
check('two clean builds are compared', /build_once "\$OUT\/run-1"/.test(harness) && /build_once "\$OUT\/run-2"/.test(harness) && /cmp -s/.test(harness), 'reproducibility cannot be inferred from one build');
check('cache is excluded from proof', /--no-cache/.test(harness), 'shared cache can conceal undeclared inputs');
check('artifact inventory is content hashed', /sha256sum/.test(harness), 'file names alone do not prove equality');

for (const pass of passes) console.log(`PASS ${pass}`);
for (const failure of failures) console.error(`FAIL ${failure}`);

if (!existsSync(new URL('../../package-lock.json', import.meta.url))) {
  console.error('BLOCKED repository currently has no package-lock.json; executable build must reject until one is generated and reviewed');
  process.exitCode = 2;
} else if (failures.length) {
  process.exitCode = 1;
} else {
  console.log('ACCEPT build contract');
}
