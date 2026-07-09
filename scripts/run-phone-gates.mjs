import { spawnSync } from 'node:child_process';

const run = (label, command, args) => {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`Unable to start ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
};

run('phone contract', 'node', ['scripts/phone-contract-check.mjs']);
run('production build', 'npm', ['run', 'build']);

console.log('\nPhone static gates passed.');
console.log('Browser smoke gate remains: npm run test:smoke');
console.log('Keep no autoplay, tap-to-start, wordless surface, and phone-first stability before adding composition layers.');
